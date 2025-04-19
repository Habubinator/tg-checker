const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const ppUserPrefs = require("puppeteer-extra-plugin-user-preferences");

puppeteer.use(StealthPlugin());

puppeteer.use(
    ppUserPrefs({
        userPrefs: {
            devtools: {
                preferences: {
                    currentDockState: '"undocked"',
                },
            },
        },
    })
);

async function start() {
    const browser = await puppeteer.launch({
        headless: false,
        args: ["--no-sandbox"],
    });

    const existingPages = await browser.pages();
    for (const page of existingPages) {
        await page.setRequestInterception(true);
        page.on("request", () => {});
        page.on("response", () => {});
    }

    browser.on("targetcreated", async (target) => {
        try {
            const newPage = await target.page();
            if (newPage) {
                await newPage.setRequestInterception(true);
                newPage.on("request", () => {});
                newPage.on("response", () => {});
            }
        } catch (error) {
            console.error("Ошибка при обработке новой вкладки:", error);
        }
    });
}

start().catch((error) => {
    console.error("Error:", error);
});
