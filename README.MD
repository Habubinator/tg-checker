# Interceptor

Interceptor is a NodeJS module for caching and reusing puppeteer request.

## Installation

Download archive in project folder and install dependencies.

```bash
npm i uuid puppeteer @lem0-packages/puppeteer-page-proxy file-system-cache@^2.4.7
```

## Usage

```javascript
const { Interceptor, CacheProvider } = require("./requestInterceptor");
const puppeteer = require("puppeteer"); // or any other puppeteer module such "puppeteer-extra";

async function start() {
    const browser = await puppeteer.launch({
        headless: false,
        args: ["--no-sandbox"],
    });

    // Creating Interceptor - ALL VALUES ARE OPTIONAL
    const interceptor = new Interceptor({
        // proxy: "https://example.com", // Or socks proxy - socks5://localhost:1080
        cacheProvider: new CacheProvider({
            // USE ONLY WHEN ALREADY HAVE CACHEPROVIDER WITH GET & SET FUNCTIONS
            // Settings for your implementation of cache provider
        }),
        cachePath: "./cache", // Path where cache files are stored
        ns: "puppeteer", // A grouping namespace for items.
        hash: "sha1", // A hashing algorithm used within the cache key.
        ttl: 60 * 60, // How long would items be cached (by default)
        filters: [
            {
                url: "https://static.wikia.nocookie.net/copyright-battle/images/5/53/%D0%A1%D0%BB%D0%BE%D0%BD.jpg/revision/latest?cb=20210217134306&path-prefix=ru",
            },
            {
                uuid: "123", // UUID as a key for cache record - provide constant to re-use cache on different startups
                // method: "GET",
                url: "https://media.izi.travel/b01d3830-4c8c-481e-9df9-b9bd0d5a69f1/a80de57c-656f-4948-971b-23db243a02c3_800x600.jpg",
                // resourseType: "image",
                // isSameSite: true,
                ttl: 60 * 60, // How long would this item be cached (TTL is in seconds)
            },
        ],
        logRequest: (data) => {
            if (data.filterApplied) {
                console.log(data);
            }
        },
    });

    // Attaching Interceptor to existing pages
    const existingPages = await browser.pages();
    for (const page of existingPages) {
        console.log("Существующая вкладка обнаружена");
        await page.setRequestInterception(true);
        page.on("request", interceptor.reqMiddleware);
        page.on("response", interceptor.resMiddleware);
    }

    // Attaching Interceptor to future pages
    browser.on("targetcreated", async (target) => {
        try {
            const newPage = await target.page();
            if (newPage) {
                console.log("Новая вкладка обнаружена");
                await newPage.setRequestInterception(true);
                newPage.on("request", interceptor.reqMiddleware);
                newPage.on("response", interceptor.resMiddleware);
            }
        } catch (error) {
            console.error("Ошибка при обработке новой вкладки:", error);
        }
    });
}

start().catch((error) => {
    console.error("Error:", error);
});
```
