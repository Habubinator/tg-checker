import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import UserPreferencesPlugin from "puppeteer-extra-plugin-user-preferences";
import pageProxy from "@lem0-packages/puppeteer-page-proxy";
import { getRandomUserAgent } from "../utils/userAgent";
import { CONFIG } from "../config";
import { AppLink, Proxy } from "../../generated/prisma";
import { repository } from "../db/repository";

puppeteer.use(StealthPlugin());
puppeteer.use(
    UserPreferencesPlugin({
        userPrefs: {
            webkit: {
                webSecurityEnabled: false,
            },
        },
    })
);

export interface CheckResult {
    appLink: AppLink;
    proxy?: Proxy;
    isAvailable: boolean;
    errorMessage?: string;
    appName?: string;
}

export class AppChecker {
    async checkApp(appLink: AppLink, proxy?: Proxy): Promise<CheckResult> {
        const browser = await puppeteer.launch({
            headless: true,
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-web-security",
            ],
        });

        try {
            const page = await browser.newPage();

            // Set a random user agent
            await page.setUserAgent(getRandomUserAgent());

            // Set proxy if provided
            if (proxy) {
                const proxyUrl =
                    proxy.username && proxy.password
                        ? `${proxy.type.toLowerCase()}://${proxy.username}:${
                              proxy.password
                          }@${proxy.ipAddress}:${proxy.port}`
                        : `${proxy.type.toLowerCase()}://${proxy.ipAddress}:${
                              proxy.port
                          }`;

                await pageProxy(page, proxyUrl);
            }

            // Set timeout
            await page.setDefaultNavigationTimeout(CONFIG.app.requestTimeout);

            // Navigate to the app page
            await page.goto(appLink.url, { waitUntil: "domcontentloaded" });

            // Check if the app is available
            const found = (await page.$("#error-section")) == null;

            // Try to extract app name if available
            let appName = appLink.appName;
            if (!appName) {
                try {
                    appName = await page.$eval("h1", (el) =>
                        el.textContent.trim()
                    );
                } catch (error) {
                    // Ignore extraction errors
                }
            }

            const result: CheckResult = {
                appLink,
                proxy,
                isAvailable: found,
                appName,
            };

            if (!found) {
                if (await repository.wasLinkActive(appLink.id)) {
                    result.errorMessage = "Недоступно";
                } else {
                    result.errorMessage = "Модерация";
                }
            } else {
                await repository.makeActive(appLink.id);
            }

            return result;
        } catch (error) {
            return {
                appLink,
                proxy,
                isAvailable: false,
                errorMessage: `Error: ${error.message}`,
            };
        } finally {
            await browser.close();
        }
    }

    async delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

export const appChecker = new AppChecker();
