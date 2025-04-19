import {
    PrismaClient,
    Proxy,
    AppLink,
    User,
    CheckSchedule,
    CheckResult,
    ProxyType,
} from "../../generated/prisma";

const prisma = new PrismaClient();

export class Repository {
    // User management
    async getOrCreateUser(
        telegramId: string,
        username?: string,
        firstName?: string,
        lastName?: string
    ): Promise<User> {
        const user = await prisma.user.upsert({
            where: { telegramId },
            update: { username, firstName, lastName },
            create: { telegramId, username, firstName, lastName },
        });
        return user;
    }

    // App links management
    async addAppLink(
        userId: string,
        url: string,
        packageName: string,
        appName?: string
    ): Promise<AppLink> {
        return prisma.appLink.create({
            data: { url, packageName, appName, userId },
        });
    }

    async getUserAppLinks(userId: string): Promise<AppLink[]> {
        return prisma.appLink.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
        });
    }

    async deleteAppLink(id: string, userId: string): Promise<AppLink> {
        return prisma.appLink.delete({
            where: { id, userId },
        });
    }

    async updateAppLink(
        id: string,
        userId: string,
        data: Partial<AppLink>
    ): Promise<AppLink> {
        return prisma.appLink.update({
            where: { id, userId },
            data,
        });
    }

    // Proxy management
    async addProxy(
        userId: string,
        ipAddress: string,
        port: string,
        type: ProxyType = "HTTP",
        username?: string,
        password?: string
    ): Promise<Proxy> {
        return prisma.proxy.create({
            data: { ipAddress, port, username, password, type, userId },
        });
    }

    async getUserProxies(userId: string): Promise<Proxy[]> {
        return prisma.proxy.findMany({
            where: { userId, isActive: true },
            orderBy: { lastUsed: "asc" },
        });
    }

    async deleteProxy(id: string, userId: string): Promise<Proxy> {
        return prisma.proxy.delete({
            where: { id, userId },
        });
    }

    async updateProxy(
        id: string,
        userId: string,
        data: Partial<Proxy>
    ): Promise<Proxy> {
        return prisma.proxy.update({
            where: { id, userId },
            data,
        });
    }

    async updateProxyLastUsed(id: string): Promise<Proxy> {
        return prisma.proxy.update({
            where: { id },
            data: { lastUsed: new Date() },
        });
    }

    // Check schedule management
    async addCheckSchedule(
        userId: string,
        time: string
    ): Promise<CheckSchedule> {
        return prisma.checkSchedule.create({
            data: { time, userId },
        });
    }

    async getUserCheckSchedules(userId: string): Promise<CheckSchedule[]> {
        return prisma.checkSchedule.findMany({
            where: { userId },
            orderBy: { time: "asc" },
        });
    }

    async deleteCheckSchedule(
        id: string,
        userId: string
    ): Promise<CheckSchedule> {
        return prisma.checkSchedule.delete({
            where: { id, userId },
        });
    }

    async updateCheckSchedule(
        id: string,
        userId: string,
        data: Partial<CheckSchedule>
    ): Promise<CheckSchedule> {
        return prisma.checkSchedule.update({
            where: { id, userId },
            data,
        });
    }

    // Check results management
    async addCheckResult(
        appLinkId: string,
        isAvailable: boolean,
        proxyId?: string,
        errorMessage?: string
    ): Promise<CheckResult> {
        return prisma.checkResult.create({
            data: { appLinkId, isAvailable, proxyId, errorMessage },
        });
    }

    async getLatestCheckResults(userId: string): Promise<CheckResult[]> {
        const appLinks = await prisma.appLink.findMany({
            where: { userId },
            select: { id: true },
        });

        const appLinkIds = appLinks.map((link) => link.id);

        return prisma.checkResult.findMany({
            where: {
                appLinkId: { in: appLinkIds },
            },
            orderBy: { checkTime: "desc" },
            take: appLinkIds.length,
            distinct: ["appLinkId"],
            include: {
                appLink: true,
                proxy: true,
            },
        });
    }

    // Get all active users with schedules
    async getUsersWithSchedule(time: string): Promise<User[]> {
        return prisma.user.findMany({
            where: {
                checkSchedules: {
                    some: {
                        time,
                        isActive: true,
                    },
                },
            },
            include: {
                appLinks: true,
                proxies: {
                    where: { isActive: true },
                },
            },
        });
    }

    // Get all users
    async getAllUsers(): Promise<User[]> {
        return prisma.user.findMany();
    }
}

export const repository = new Repository();
