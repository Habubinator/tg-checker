import { prisma } from "../database/prisma.database";
import { googlePlayChecker } from "./googlePlayChecker";
import { proxyService } from "./proxyService";
import { bot } from "../bot";
import { CheckResult } from "@prisma/client";
import cron from "node-cron";

interface ScheduledJob {
    cron: cron.ScheduledTask;
    timeString: string;
    userId: string;
}

export class SchedulerService {
    private jobs: ScheduledJob[] = [];

    constructor() {
        this.initialize();
    }

    private async initialize() {
        try {
            // Load all active schedules from the database
            const schedules = await prisma.checkSchedule.findMany({
                where: { isActive: true },
                include: { user: true },
            });

            // Set up cron jobs for each schedule
            for (const schedule of schedules) {
                this.scheduleJob(schedule.userId, schedule.time);
            }

            console.log(`Initialized ${this.jobs.length} scheduled check jobs`);
        } catch (error) {
            console.error("Error initializing scheduler:", error);
        }
    }

    /**
     * Schedule a check job at a specific time
     */
    public scheduleJob(userId: string, timeString: string): boolean {
        try {
            // Parse time string (HH:MM) into cron format
            const [hours, minutes] = timeString.split(":");
            const cronExpression = `${minutes} ${hours} * * *`;

            // Validate cron expression
            if (!cron.validate(cronExpression)) {
                return false;
            }

            // Schedule the job
            const job = cron.schedule(cronExpression, () => {
                this.runScheduledCheck(userId);
            });

            // Store the job reference
            this.jobs.push({
                cron: job,
                timeString,
                userId,
            });

            return true;
        } catch (error) {
            console.error("Error scheduling job:", error);
            return false;
        }
    }

    /**
     * Run scheduled check for a user
     */
    private async runScheduledCheck(userId: string) {
        try {
            console.log(`Running scheduled check for user ${userId}`);

            // Get user info to send message
            const user = await prisma.user.findUnique({
                where: { id: userId },
            });

            if (!user || !user.telegramId) {
                console.error(`User ${userId} not found or missing telegramId`);
                return;
            }

            // Get all app links for the user
            const appLinks = await prisma.appLink.findMany({
                where: { userId },
            });

            if (appLinks.length === 0) {
                await bot.sendMessage(
                    parseInt(user.telegramId),
                    "⚠️ Запланированная проверка: Нет добавленных ссылок для проверки."
                );
                return;
            }

            // Send initial message
            await bot.sendMessage(
                parseInt(user.telegramId),
                `🔍 Запуск плановой проверки ${appLinks.length} приложений...`
            );

            // Run checks for each app link
            const results = await this.checkAllApps(
                userId,
                appLinks.map((link) => link.id)
            );

            // Format and send results
            const summary = this.formatCheckResults(results);
            await bot.sendMessage(parseInt(user.telegramId), summary);
        } catch (error) {
            console.error("Error running scheduled check:", error);
        }
    }

    /**
     * Check all apps for a specific user
     */
    public async checkAllApps(
        userId: string,
        appLinkIds?: string[]
    ): Promise<CheckResult[]> {
        try {
            const results: CheckResult[] = [];

            // Get app links to check (either specified or all for the user)
            const appLinks = await prisma.appLink.findMany({
                where: appLinkIds
                    ? { id: { in: appLinkIds }, userId }
                    : { userId },
            });

            for (const appLink of appLinks) {
                // Get a proxy for this check
                const proxy = await proxyService.getNextProxy(userId);

                // Check the app availability
                const checkResult =
                    await googlePlayChecker.checkAppAvailability(
                        appLink.url,
                        proxy
                            ? {
                                  ipAddress: proxy.ipAddress,
                                  port: proxy.port,
                                  username: proxy.username || undefined,
                                  password: proxy.password || undefined,
                              }
                            : undefined
                    );

                // Save the result to database
                const savedResult = await prisma.checkResult.create({
                    data: {
                        appLinkId: appLink.id,
                        proxyId: proxy?.id,
                        isAvailable: checkResult.isAvailable,
                        errorMessage: checkResult.errorMessage,
                    },
                });

                results.push(savedResult);

                // Add a small delay between requests to avoid being blocked
                await new Promise((resolve) =>
                    setTimeout(resolve, 1000 + Math.random() * 2000)
                );
            }

            return results;
        } catch (error) {
            console.error("Error checking all apps:", error);
            return [];
        }
    }

    /**
     * Format check results for display
     */
    private formatCheckResults(results: CheckResult[]): string {
        if (results.length === 0) {
            return "⚠️ Нет результатов проверки.";
        }

        return `📊 Результаты проверки (${new Date().toLocaleTimeString()}):
    
${results.map((result) => this.formatSingleResult(result)).join("\n")}`;
    }

    /**
     * Format a single check result
     */
    private async formatSingleResult(result: CheckResult): Promise<string> {
        try {
            // Get app link details
            const appLink = await prisma.appLink.findUnique({
                where: { id: result.appLinkId },
            });

            if (!appLink) {
                return "❓ Неизвестное приложение";
            }

            const packageName = appLink.packageName;
            const icon = result.isAvailable ? "✅" : "❌";
            const status = result.isAvailable
                ? "Доступно"
                : result.errorMessage ||
                  "Это приложение сейчас временно недоступно";

            return `${icon} ${packageName} — ${status}`;
        } catch (error) {
            console.error("Error formatting result:", error);
            return "⚠️ Ошибка при форматировании результата";
        }
    }

    /**
     * Remove all scheduled jobs for a user
     */
    public removeUserJobs(userId: string): number {
        let count = 0;

        // Find all jobs for this user and stop them
        this.jobs = this.jobs.filter((job) => {
            if (job.userId === userId) {
                job.cron.stop();
                count++;
                return false;
            }
            return true;
        });

        return count;
    }

    /**
     * Add or update a scheduled time for a user
     */
    public async updateSchedule(
        userId: string,
        timeString: string
    ): Promise<boolean> {
        try {
            // Validate time format
            if (!/^\d{1,2}:\d{2}$/.test(timeString)) {
                return false;
            }

            // Check if this schedule already exists
            const existingSchedule = await prisma.checkSchedule.findFirst({
                where: {
                    userId,
                    time: timeString,
                },
            });

            if (existingSchedule) {
                // Update existing schedule if needed
                if (!existingSchedule.isActive) {
                    await prisma.checkSchedule.update({
                        where: { id: existingSchedule.id },
                        data: { isActive: true },
                    });
                }
            } else {
                // Create new schedule
                await prisma.checkSchedule.create({
                    data: {
                        userId,
                        time: timeString,
                        isActive: true,
                    },
                });
            }

            // Remove existing job for this time if any
            this.jobs = this.jobs.filter((job) => {
                if (job.userId === userId && job.timeString === timeString) {
                    job.cron.stop();
                    return false;
                }
                return true;
            });

            // Schedule new job
            return this.scheduleJob(userId, timeString);
        } catch (error) {
            console.error("Error updating schedule:", error);
            return false;
        }
    }
}

export const schedulerService = new SchedulerService();
