import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { Browser, Page } from "puppeteer";
import useProxy from "@lem0-packages/puppeteer-page-proxy";
import { GooglePlayAppResult, ParsedProxy } from "../types";
import { v4 as uuidv4 } from "uuid";

// Initialize stealth puppeteer
puppeteer.use(StealthPlugin());

// User agent rotation
const USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.84 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.4 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:99.0) Gecko/20100101 Firefox/99.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.75 Safari/537.36",
];

class GooglePlayCheckerService {
    private browser: Browser | null = null;

    constructor() {
        this.initBrowser();
    }

    private async initBrowser(): Promise<void> {
        try {
            this.browser = await puppeteer.launch({
                headless: false,
                args: [
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-accelerated-2d-canvas",
                    "--disable-gpu",
                ],
            });

            console.log("Browser initialized successfully");
        } catch (error) {
            console.error("Failed to initialize browser:", error);
            throw new Error("Browser initialization failed");
        }
    }

    private getRandomUserAgent(): string {
        return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    }

    public async checkAppAvailability(
        url: string,
        proxy?: ParsedProxy
    ): Promise<GooglePlayAppResult> {
        if (!this.browser) {
            await this.initBrowser();
        }

        if (!this.browser) {
            throw new Error("Browser is not initialized");
        }

        const packageName = this.extractPackageName(url);
        if (!packageName) {
            return {
                packageName: "unknown",
                isAvailable: false,
                errorMessage: "Invalid Google Play URL",
            };
        }

        const page = await this.browser.newPage();

        try {
            // Set random user agent
            await page.setUserAgent(this.getRandomUserAgent());

            // Set proxy if provided
            if (proxy) {
                const proxyUrl = this.formatProxyUrl(proxy);
                await useProxy(page, proxyUrl);
            }

            // Set timeout for navigation
            page.setDefaultNavigationTimeout(30000);

            // Navigate to the app page
            const response = await page.goto(url, {
                waitUntil: "networkidle2",
            });

            // Check if the app is available based on response status
            const status = response?.status() || 0;

            if (status === 200) {
                // Try to extract app name
                let appName = await this.extractAppName(page);

                return {
                    packageName,
                    appName,
                    isAvailable: true,
                };
            } else {
                return {
                    packageName,
                    isAvailable: false,
                    errorMessage: `Это приложение сейчас временно недоступно (Status: ${status})`,
                };
            }
        } catch (error) {
            console.error(`Error checking app ${packageName}:`, error);
            return {
                packageName,
                isAvailable: false,
                errorMessage: "Это приложение сейчас временно недоступно",
            };
        } finally {
            await page.close();
        }
    }

    private extractPackageName(url: string): string | null {
        const match = url.match(/[?&]id=([^&]+)/);
        return match ? match[1] : null;
    }

    private async extractAppName(page: Page): Promise<string | undefined> {
        try {
            const appNameElement = await page.$('h1[itemprop="name"]');
            if (appNameElement) {
                return await page.evaluate(
                    (el) => el.textContent,
                    appNameElement
                );
            }

            // Fallback to other selectors
            const titleElement = await page.$("h1");
            if (titleElement) {
                return await page.evaluate(
                    (el) => el.textContent,
                    titleElement
                );
            }

            return undefined;
        } catch (error) {
            console.error("Error extracting app name:", error);
            return undefined;
        }
    }

    private formatProxyUrl(proxy: ParsedProxy): string {
        if (proxy.username && proxy.password) {
            return `http://${proxy.username}:${proxy.password}@${proxy.ipAddress}:${proxy.port}`;
        }
        return `http://${proxy.ipAddress}:${proxy.port}`;
    }

    public async close(): Promise<void> {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
}

export const googlePlayChecker = new GooglePlayCheckerService();
