import { prisma } from "../database/prisma.database";
import { ParsedProxy } from "../types";
import { Proxy, ProxyType as DBProxyType } from "@prisma/client";
import https from "https";
import http from "http";
import { SocksProxyAgent } from "socks-proxy-agent";

export class ProxyService {
    /**
     * Parse proxy string format: ip:port or ip:port:username:password
     */
    public parseProxyString(proxyString: string): ParsedProxy | null {
        try {
            const parts = proxyString.trim().split(":");

            if (parts.length < 2) {
                return null;
            }

            if (parts.length === 2) {
                return {
                    ipAddress: parts[0],
                    port: parts[1],
                };
            }

            if (parts.length === 4) {
                return {
                    ipAddress: parts[0],
                    port: parts[1],
                    username: parts[2],
                    password: parts[3],
                };
            }

            return null;
        } catch (error) {
            console.error("Error parsing proxy string:", error);
            return null;
        }
    }

    /**
     * Test if proxy is working
     */
    public async testProxy(
        proxy: ParsedProxy,
        proxyType: DBProxyType = DBProxyType.HTTP
    ): Promise<boolean> {
        return new Promise((resolve) => {
            try {
                const testUrl = "https://www.google.com";
                const timeout = 10000; // 10 seconds timeout

                let requestOptions: any = {
                    method: "HEAD",
                    timeout: timeout,
                };

                let proxyAgent;

                switch (proxyType) {
                    case DBProxyType.HTTP:
                    case DBProxyType.HTTPS:
                        const proxyUrl = this.formatProxyUrl(
                            proxy,
                            proxyType === DBProxyType.HTTPS
                        );
                        requestOptions.agent = new (
                            proxyType === DBProxyType.HTTPS
                                ? https.Agent
                                : http.Agent
                        )({
                            host: proxy.ipAddress,
                            port: parseInt(proxy.port),
                            ...(proxy.username && proxy.password
                                ? {
                                      auth: `${proxy.username}:${proxy.password}`,
                                  }
                                : {}),
                        });
                        break;

                    case DBProxyType.SOCKS5:
                        const socksProxyUrl = `socks5://${
                            proxy.username && proxy.password
                                ? `${proxy.username}:${proxy.password}@`
                                : ""
                        }${proxy.ipAddress}:${proxy.port}`;
                        proxyAgent = new SocksProxyAgent(socksProxyUrl);
                        requestOptions.agent = proxyAgent;
                        break;
                }

                const req = https.request(testUrl, requestOptions, (res) => {
                    resolve(res.statusCode >= 200 && res.statusCode < 300);
                });

                req.on("error", () => {
                    resolve(false);
                });

                req.on("timeout", () => {
                    req.destroy();
                    resolve(false);
                });

                req.end();
            } catch (error) {
                console.error("Error testing proxy:", error);
                resolve(false);
            }
        });
    }

    /**
     * Get next available proxy from the pool for a specific user
     */
    public async getNextProxy(userId: string): Promise<Proxy | null> {
        try {
            // Find the least recently used active proxy
            const proxy = await prisma.proxy.findFirst({
                where: {
                    userId: userId,
                    isActive: true,
                },
                orderBy: {
                    lastUsed: "asc",
                },
            });

            if (proxy) {
                // Update last used timestamp
                await prisma.proxy.update({
                    where: { id: proxy.id },
                    data: { lastUsed: new Date() },
                });

                return proxy;
            }

            return null;
        } catch (error) {
            console.error("Error getting next proxy:", error);
            return null;
        }
    }

    /**
     * Format proxy URL for HTTP requests
     */
    private formatProxyUrl(
        proxy: ParsedProxy,
        isHttps: boolean = false
    ): string {
        const protocol = isHttps ? "https" : "http";
        if (proxy.username && proxy.password) {
            return `${protocol}://${proxy.username}:${proxy.password}@${proxy.ipAddress}:${proxy.port}`;
        }
        return `${protocol}://${proxy.ipAddress}:${proxy.port}`;
    }

    /**
     * Add batch of proxies for a user
     */
    public async addProxies(
        userId: string,
        proxyStrings: string[]
    ): Promise<{
        added: number;
        invalid: number;
    }> {
        let added = 0;
        let invalid = 0;

        for (const proxyString of proxyStrings) {
            const parsedProxy = this.parseProxyString(proxyString);

            if (parsedProxy) {
                await prisma.proxy.create({
                    data: {
                        ipAddress: parsedProxy.ipAddress,
                        port: parsedProxy.port,
                        username: parsedProxy.username,
                        password: parsedProxy.password,
                        type: DBProxyType.HTTP, // Default type
                        user: {
                            connect: {
                                id: userId,
                            },
                        },
                    },
                });

                added++;
            } else {
                invalid++;
            }
        }

        return { added, invalid };
    }
}

export const proxyService = new ProxyService();
