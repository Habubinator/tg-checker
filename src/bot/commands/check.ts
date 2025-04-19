import TelegramBot from "node-telegram-bot-api";
import { repository } from "../../db/repository";
import { Keyboard } from "../keyboard";
import { appChecker } from "../../services/appChecker";
import { proxyManager } from "../../services/proxyManager";
import { CONFIG } from "../../config";

export class CheckCommands {
    private bot: TelegramBot;
    private runningChecks: Record<string, boolean> = {};

    constructor(bot: TelegramBot) {
        this.bot = bot;
    }

    registerHandlers() {
        // Handle button clicks
        this.bot.onText(
            /🔍 Запустить проверку/,
            this.handleStartCheck.bind(this)
        );
        this.bot.onText(
            /🔄 Статус проверки/,
            this.handleCheckStatus.bind(this)
        );

        // Handle callback queries
        this.bot.on("callback_query", this.handleCallbackQuery.bind(this));
    }

    private async handleStartCheck(msg: TelegramBot.Message) {
        const chatId = msg.chat.id.toString();

        // Check if a check is already running for this user
        if (this.runningChecks[chatId]) {
            await this.bot.sendMessage(
                chatId,
                "⚠️ Проверка уже выполняется. Пожалуйста, дождитесь ее завершения."
            );
            return;
        }

        // Get user
        const user = await repository.getOrCreateUser(
            chatId,
            msg.chat.username,
            msg.chat.first_name,
            msg.chat.last_name
        );

        // Get user links
        const appLinks = await repository.getUserAppLinks(user.id);

        if (appLinks.length === 0) {
            await this.bot.sendMessage(
                chatId,
                "⚠️ У вас нет добавленных ссылок для проверки."
            );
            return;
        }

        // Ask for proxy usage
        await this.bot.sendMessage(
            chatId,
            `Найдено ${appLinks.length} ссылок для проверки. Использовать прокси?`,
            {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: "✅ Да, с прокси",
                                callback_data: "check_with_proxy",
                            },
                            {
                                text: "❌ Нет, без прокси",
                                callback_data: "check_without_proxy",
                            },
                        ],
                    ],
                },
            }
        );
    }

    private async handleCheckStatus(msg: TelegramBot.Message) {
        const chatId = msg.chat.id.toString();
        const user = await repository.getOrCreateUser(
            chatId,
            msg.chat.username,
            msg.chat.first_name,
            msg.chat.last_name
        );

        // Get the latest check results
        const results = await repository.getLatestCheckResults(user.id);

        if (results.length === 0) {
            await this.bot.sendMessage(
                chatId,
                "⚠️ История проверок пуста. Запустите проверку, чтобы увидеть результаты."
            );
            return;
        }

        // Format results
        const resultMessages = results.map((result) => {
            const date = result.checkTime.toLocaleDateString();
            const time = result.checkTime.toLocaleTimeString();

            if (result.isAvailable) {
                return `✅ ${result.appLink.packageName} — Доступно (${date} ${time})`;
            } else {
                return `❌ ${result.appLink.packageName} — ${
                    result.errorMessage || "Временно недоступно"
                } (${date} ${time})`;
            }
        });

        await this.bot.sendMessage(
            chatId,
            `📊 Последние результаты проверок:\n\n${resultMessages.join("\n")}`,
            { reply_markup: Keyboard.getMainKeyboard() }
        );
    }

    private async handleCallbackQuery(query: TelegramBot.CallbackQuery) {
        if (!query.message || !query.data) return;

        const chatId = query.message.chat.id.toString();

        // Handle check with proxy
        if (query.data === "check_with_proxy") {
            await this.bot.answerCallbackQuery(query.id);
            await this.runCheck(chatId, true);
        }

        // Handle check without proxy
        else if (query.data === "check_without_proxy") {
            await this.bot.answerCallbackQuery(query.id);
            await this.runCheck(chatId, false);
        }
    }

    async runCheck(telegramId: string, useProxy: boolean) {
        // Prevent multiple checks running simultaneously for the same user
        if (this.runningChecks[telegramId]) {
            return;
        }

        this.runningChecks[telegramId] = true;

        try {
            const user = await repository.getOrCreateUser(telegramId);
            const appLinks = await repository.getUserAppLinks(user.id);

            if (appLinks.length === 0) {
                await this.bot.sendMessage(
                    telegramId,
                    "⚠️ У вас нет добавленных ссылок для проверки."
                );
                return;
            }

            // Send initial message
            const statusMessage = await this.bot.sendMessage(
                telegramId,
                `🔄 Запускаю проверку ${appLinks.length} приложений${
                    useProxy ? " с использованием прокси" : ""
                }...`
            );

            const results = [];
            let completedChecks = 0;

            for (const appLink of appLinks) {
                // Get proxy for this check if needed
                const proxy = useProxy
                    ? await proxyManager.getNextProxy(user.id)
                    : undefined;

                if (useProxy && !proxy) {
                    await this.bot.sendMessage(
                        telegramId,
                        "⚠️ Нет доступных прокси. Проверка будет выполнена без прокси."
                    );
                }

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

            // Send final results
            const resultMessages = results.map((result) => {
                if (result.isAvailable) {
                    return `✅ ${result.appLink.packageName} — Доступно`;
                } else {
                    return `❌ ${result.appLink.packageName} — ${
                        result.errorMessage ||
                        "Это приложение сейчас временно недоступно"
                    }`;
                }
            });

            await this.bot.editMessageText(
                `✅ Проверка завершена!\n\n${resultMessages.join("\n")}`,
                {
                    chat_id: telegramId,
                    message_id: statusMessage.message_id,
                }
            );
        } catch (error) {
            console.error("Error during check:", error);
            await this.bot.sendMessage(
                telegramId,
                `❌ Ошибка при выполнении проверки: ${error.message}`
            );
        } finally {
            this.runningChecks[telegramId] = false;
        }
    }
}
