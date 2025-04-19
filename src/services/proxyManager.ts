import { repository } from "../db/repository";
import { Proxy } from "../../generated/prisma";

export class ProxyManager {
    async getNextProxy(userId: string): Promise<Proxy | null> {
        const proxies = await repository.getUserProxies(userId);

        if (proxies.length === 0) {
            return null;
        }

        // Get the least recently used proxy
        const proxy = proxies[0];

        // Update last used time
        await repository.updateProxyLastUsed(proxy.id);

        return proxy;
    }
}

export const proxyManager = new ProxyManager();
