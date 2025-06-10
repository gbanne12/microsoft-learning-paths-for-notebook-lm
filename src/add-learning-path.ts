import { expect, Page, chromium } from '@playwright/test';

// Microsoft learn URL for learning paths that are to be added to NotebookLM
const baseUrl = 'https://learn.microsoft.com/en-us/credentials/certifications/exams/mb-230/';

(async () => {
    // Launch chromium manually through terminal with Start-Process command
    // Example: Start-Process -FilePath "C:\Program Files\Google\Chrome\Application\chrome.exe" -ArgumentList "--remote-debugging-port=9222"
    // Then sign in to your Google account prior to invoking
    const browser = await chromium.connectOverCDP('http://localhost:9222');
    const page = browser.contexts()[0].pages()[0];

    const learningPaths: LearningPath[] = [];
    await page.goto(baseUrl);
    await page.waitForSelector('div[role="tabpanel"]', { state: 'visible', timeout: 10000 });
    await expandLearningPathsSection(page);

    const learningPathCards = await getLearningPathCards(page);
    for (const card of learningPathCards) {
        try {
            const learningPath = await processLearningPath(page, card);
            if (learningPath) {
                learningPaths.push(learningPath);
            }

            await page.goto(baseUrl);
            await page.waitForLoadState('networkidle');
            await expandLearningPathsSection(page);
        } catch (error) {
            console.error(`Error processing learning path: ${error}`);
            continue;
        }
    }

    // Verifications
    expect(learningPaths.length).toBeGreaterThan(0);
    expect(learningPaths.every(path => path.modules.length > 0)).toBeTruthy();

    for (const path of learningPaths) {

        for (const module of path.modules) {
            await page.goto('https://notebooklm.google.com/');
            await page.getByRole('button', { name: 'Create new notebook' }).click();
            await page.getByRole('button', { name: 'Close dialog' }).click();

            for (const unit of module.units) {
                await page.getByRole('button', { name: 'Add source' }).click();
                await page.getByText('Website', { exact: true }).click();
                await page.getByRole('textbox', { name: 'Paste URL' }).fill(unit.url);
                await page.getByRole('button', { name: 'Insert' }).click();
            }
        }
    }
})();

interface ModuleUnit {
    name: string;
    url: string;
}

interface Module {
    name: string;
    url: string;
    units: ModuleUnit[];
}

interface LearningPath {
    name: string;
    url: string;
    modules: Module[];
}

async function expandLearningPathsSection(page: Page): Promise<void> {
    const seeMoreButton = page.getByRole('button', { name: 'See less' });
    if (!(await seeMoreButton.isVisible({ timeout: 5000 }))) {
        const expandButton = page.getByRole('button', { name: 'See more' });
        if (await expandButton.isVisible()) {
            await expandButton.click();
            await page.waitForTimeout(1000);
        }
    }
}

async function getLearningPathCards(page: Page) {
    return page.locator('article').filter({
        has: page.locator('a[href*="/training/paths/"]')
    }).all();
}

async function collectModules(page: Page, pathName: string): Promise<Map<string, Module>> {
    let moduleMap = new Map<string, Module>();
    let retryCount = 0;

    while (retryCount < 3 && moduleMap.size === 0) {
        try {
            await page.waitForSelector('a[href*="/training/modules/"]', { timeout: 10000 });
            const moduleElements = await page.locator('a[href*="/training/modules/"]').all();

            for (const moduleElement of moduleElements) {
                const href = await moduleElement.getAttribute('href');
                if (href) {
                    const fullModuleUrl = href.startsWith('http') ? href : `https://learn.microsoft.com${href}`;
                    const moduleUrlParts = new URL(fullModuleUrl);
                    const pathParts = moduleUrlParts.pathname.split('/modules/')[1].split('/');
                    const moduleName = pathParts[0];
                    const unitPath = pathParts.slice(1).join('/');

                    if (!moduleMap.has(moduleName)) {
                        moduleMap.set(moduleName, {
                            name: moduleName,
                            url: `https://learn.microsoft.com/en-us/training/modules/${moduleName}/`,
                            units: []
                        });
                    }

                    const unitName = await moduleElement.textContent() || unitPath;
                    moduleMap.get(moduleName)?.units.push({
                        name: unitName.trim(),
                        url: fullModuleUrl
                    });
                }
            }
        } catch (error) {
            console.log(`Retry ${retryCount + 1} for ${pathName}`);
            retryCount++;
            if (retryCount < 3) {
                await page.reload();
                await page.waitForLoadState('networkidle');
            }
        }
    }

    return moduleMap;
}

async function processLearningPath(page: Page, card: any): Promise<LearningPath | null> {
    const pathLink = await card.locator('a[href*="/training/paths/"]').first();
    const pathName = (await pathLink.textContent() || '').trim();
    const pathUrl = await pathLink.getAttribute('href') || '';

    if (!pathUrl) {
        console.log(`Skipping path with no URL: ${pathName}`);
        return null;
    }

    const fullPathUrl = pathUrl.startsWith('http') ? pathUrl : `https://learn.microsoft.com${pathUrl}`;
    console.log(`Processing learning path: ${pathName}`);

    await page.goto(fullPathUrl);
    await page.waitForLoadState('networkidle');

    const moduleMap = await collectModules(page, pathName);

    if (moduleMap.size > 0) {
        return {
            name: pathName,
            url: fullPathUrl,
            modules: Array.from(moduleMap.values())
        };
    }

    return null;
}