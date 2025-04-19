export interface ParsedProxy {
    ipAddress: string;
    port: string;
    username?: string;
    password?: string;
}

export interface ParsedAppLink {
    url: string;
    packageName: string;
}

export function parseGooglePlayLinks(input: string): ParsedAppLink[] {
    const links: ParsedAppLink[] = [];
    const lines = input.split("\n");

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        try {
            const url = new URL(trimmedLine);
            if (
                url.hostname.includes("play.google.com") &&
                url.pathname.includes("/store/apps/details")
            ) {
                const packageName = url.searchParams.get("id");
                if (packageName) {
                    links.push({
                        url: trimmedLine,
                        packageName,
                    });
                }
            }
        } catch (error) {
            // Skip invalid URLs
            continue;
        }
    }

    return links;
}

export function parseProxies(input: string): ParsedProxy[] {
    const proxies: ParsedProxy[] = [];
    const lines = input.split("\n");

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        const parts = trimmedLine.split(":");

        if (parts.length >= 2) {
            const proxy: ParsedProxy = {
                ipAddress: parts[0],
                port: parts[1],
            };

            if (parts.length >= 4) {
                proxy.username = parts[2];
                proxy.password = parts[3];
            }

            proxies.push(proxy);
        }
    }

    return proxies;
}

export function isValidTimeFormat(time: string): boolean {
    const regex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    return regex.test(time);
}
