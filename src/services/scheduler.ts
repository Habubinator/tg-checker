import cron from "node-cron";
import { repository } from "../db/repository";
import { appChecker } from "./appChecker";
import { proxyManager } from "./proxyManager";
import { CONFIG } from "../config";
import TelegramBot from "node-telegram-bot-api";

export class Scheduler {
    private bot: TelegramBot;
    private runningChecks: Record<string, boolean> = {};

    constructor(bot: TelegramBot) {
        this.bot = bot;
    }

    init() {
        // Check every minute for scheduled tasks
        cron.schedule("* * * * *", async () => {
            const now = new Date();
            const currentTime = `${now
                .getHours()
                .toString()
                .padStart(2, "0")}:${now
                .getMinutes()
                .toString()
                .padStart(2, "0")}`;

            try {
                const users = await repository.getUsersWithSchedule(
                    currentTime
                );

                for (const user of users) {
                    // Start check for each user with this scheduled time
                    this.runCheck(user.telegramId);
                }
            } catch (error) {
                console.error("Error running scheduled check:", error);
            }
        });
    }

    async runCheck(telegramId: string) {
        // Prevent multiple checks running simultaneously for the same user
        if (this.runningChecks[telegramId]) {
            return;
        }

        this.runningChecks[telegramId] = true;

        try {
            const user = await repository.getOrCreateUser(telegramId);
            const appLinks = await repository.getUserAppLinks(user.id);

            if (appLinks.length === 0) {
                this.bot.sendMessage(
                    telegramId,
                    "⚠️ У вас нет добавленных ссылок для проверки."
                );
                return;
            }

            // Send initial message
            const statusMessage = await this.bot.sendMessage(
                telegramId,
                `🔄 Запускаю проверку ${appLinks.length} приложений...`
            );

            const results = [];
            let completedChecks = 0;

            for (const appLink of appLinks) {
                // Get proxy for this check
                const proxy = await proxyManager.getNextProxy(user.id);

                // Run check
                const result = await appChecker.checkApp(appLink, proxy);
                results.push(result);

                // Save result to database
                await repository.addCheckResult(
                    appLink.id,
                    result.isAvailable,
                    proxy?.id,
                    result.errorMessage
                );

                // Update status message every 5 apps or at the end
                completedChecks++;
                if (
                    completedChecks % 5 === 0 ||
                    completedChecks === appLinks.length
                ) {
                    await this.bot.editMessageText(
                        `🔄 Проверка: ${completedChecks}/${appLinks.length} приложений...`,
                        {
                            chat_id: telegramId,
                            message_id: statusMessage.message_id,
                        }
                    );
                }

                // Add delay between requests
                await appChecker.delay(CONFIG.app.delayBetweenRequests);
            }

            // Формируем все результаты
            const resultMessages = results.map((result) => {
                if (result.isAvailable) {
                    return `✅ ${result.appLink.packageName} — Доступно`;
                } else {
                    return `❌ ${result.appLink.packageName} — ${
                        result.errorMessage || "Недоступно"
                    }`;
                }
            });

            // Константа лимита
            const MAX_MESSAGE_LENGTH = 4000; // запас для текста заголовка

            // Разбиваем на чанки
            let chunks: string[] = [];
            let currentChunk = "✅ Проверка завершена!\n\n";

            for (const message of resultMessages) {
                if (
                    (currentChunk + message + "\n").length > MAX_MESSAGE_LENGTH
                ) {
                    chunks.push(currentChunk);
                    currentChunk = message;
                } else {
                    currentChunk += (currentChunk ? "\n" : "") + message;
                }
            }
            if (currentChunk) {
                chunks.push(currentChunk);
            }

            // Отправляем первую часть через editMessageText
            await this.bot.editMessageText(chunks[0], {
                chat_id: telegramId,
                message_id: statusMessage.message_id,
            });

            // Остальные части отправляем отдельными сообщениями
            for (let i = 1; i < chunks.length; i++) {
                await this.bot.sendMessage(telegramId, chunks[i]);
            }
        } catch (error) {
            console.error("Error during check:", error);
            this.bot.sendMessage(
                telegramId,
                `❌ Ошибка при выполнении проверки: ${error.message}`
            );
        } finally {
            this.runningChecks[telegramId] = false;
        }
    }
}
