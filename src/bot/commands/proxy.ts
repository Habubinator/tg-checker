import TelegramBot from "node-telegram-bot-api";
import { repository } from "../../db/repository";
import { Keyboard } from "../keyboard";
import { parseProxies } from "../../utils/parser";
import { CONFIG } from "../../config";
import { ProxyType } from "../../../generated/prisma";

export class ProxyCommands {
    private bot: TelegramBot;
    private userStates: Record<string, { action: string; data?: any }> = {};

    constructor(bot: TelegramBot) {
        this.bot = bot;
    }

    registerHandlers() {
        // Handle button clicks
        this.bot.onText(/🔌 Добавить прокси/, this.handleAddProxies.bind(this));
        this.bot.onText(
            /⚙️ Редактировать прокси/,
            this.handleEditProxies.bind(this)
        );
        this.bot.onText(
            /🗑️ Удалить прокси/,
            this.handleDeleteProxies.bind(this)
        );

        // Handle message input for adding proxies
        this.bot.on("message", this.handleUserInput.bind(this));

        // Handle callback queries for editing/deleting proxies
        this.bot.on("callback_query", this.handleCallbackQuery.bind(this));
    }

    private async handleAddProxies(msg: TelegramBot.Message) {
        const chatId = msg.chat.id.toString();

        // Get user
        const user = await repository.getOrCreateUser(
            chatId,
            msg.chat.username,
            msg.chat.first_name,
            msg.chat.last_name
        );

        // Check if user has reached the maximum number of proxies
        const userProxies = await repository.getUserProxies(user.id);
        if (userProxies.length >= CONFIG.app.maxProxiesPerUser) {
            await this.bot.sendMessage(
                chatId,
                `⚠️ Вы достигли максимального количества прокси (${CONFIG.app.maxProxiesPerUser}). Удалите некоторые прокси перед добавлением новых.`
            );
            return;
        }

        // Set user state
        this.userStates[chatId] = { action: "add_proxies" };

        await this.bot.sendMessage(
            chatId,
            "Пожалуйста, отправьте список прокси (по одному на строку) в формате:\n" +
                "ip:port или ip:port:username:password",
            { reply_markup: Keyboard.getCancelKeyboard() }
        );
    }

    private async handleEditProxies(msg: TelegramBot.Message) {
        const chatId = msg.chat.id.toString();

        // Get user
        const user = await repository.getOrCreateUser(
            chatId,
            msg.chat.username,
            msg.chat.first_name,
            msg.chat.last_name
        );

        // Get user proxies
        const proxies = await repository.getUserProxies(user.id);

        if (proxies.length === 0) {
            await this.bot.sendMessage(
                chatId,
                "⚠️ У вас нет добавленных прокси."
            );
            return;
        }

        await this.bot.sendMessage(
            chatId,
            "Выберите прокси для редактирования:",
            { reply_markup: Keyboard.getProxiesKeyboard(proxies) }
        );
    }

    private async handleDeleteProxies(msg: TelegramBot.Message) {
        const chatId = msg.chat.id.toString();

        // Get user
        const user = await repository.getOrCreateUser(
            chatId,
            msg.chat.username,
            msg.chat.first_name,
            msg.chat.last_name
        );

        // Get user proxies
        const proxies = await repository.getUserProxies(user.id);

        if (proxies.length === 0) {
            await this.bot.sendMessage(
                chatId,
                "⚠️ У вас нет добавленных прокси."
            );
            return;
        }

        // Set user state
        this.userStates[chatId] = { action: "delete_proxies" };

        await this.bot.sendMessage(
            chatId,
            "Выберите прокси для удаления или удалите все:",
            {
                reply_markup: {
                    inline_keyboard: [
                        ...Keyboard.getProxiesKeyboard(proxies).inline_keyboard,
                        [
                            {
                                text: "🗑️ Удалить все",
                                callback_data: "delete_all_proxies",
                            },
                        ],
                    ],
                },
            }
        );
    }

    private async handleUserInput(msg: TelegramBot.Message) {
        if (!msg.text) return;

        const chatId = msg.chat.id.toString();
        const userState = this.userStates[chatId];

        if (!userState) return;

        // Handle cancel action
        if (msg.text === "🔙 Отмена") {
            delete this.userStates[chatId];
            await this.bot.sendMessage(chatId, "✅ Действие отменено.", {
                reply_markup: Keyboard.getMainKeyboard(),
            });
            return;
        }

        // Handle adding proxies
        if (userState.action === "add_proxies") {
            const parsedProxies = parseProxies(msg.text);

            if (parsedProxies.length === 0) {
                await this.bot.sendMessage(
                    chatId,
                    "⚠️ Не найдено действительных прокси. Пожалуйста, убедитесь, что прокси имеют формат: ip:port или ip:port:username:password"
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

            // Get current proxies count
            const userProxies = await repository.getUserProxies(user.id);
            const availableSlots =
                CONFIG.app.maxProxiesPerUser - userProxies.length;

            if (availableSlots <= 0) {
                await this.bot.sendMessage(
                    chatId,
                    `⚠️ Вы достигли максимального количества прокси (${CONFIG.app.maxProxiesPerUser}). Удалите некоторые прокси перед добавлением новых.`
                );
                return;
            }

            // Ask for proxy type
            const types = [
                {
                    text: "HTTP",
                    callback_data: `proxy_type_HTTP_${parsedProxies.length}`,
                },
                {
                    text: "HTTPS",
                    callback_data: `proxy_type_HTTPS_${parsedProxies.length}`,
                },
                {
                    text: "SOCKS5",
                    callback_data: `proxy_type_SOCKS5_${parsedProxies.length}`,
                },
            ];

            // Store parsed proxies in user state
            this.userStates[chatId] = {
                action: "select_proxy_type",
                data: { parsedProxies, availableSlots },
            };

            await this.bot.sendMessage(
                chatId,
                `Выберите тип прокси для ${parsedProxies.length} прокси:`,
                {
                    reply_markup: {
                        inline_keyboard: [types],
                    },
                }
            );
        }

        // Handle editing proxy
        else if (userState.action === "edit_proxy" && userState.data) {
            try {
                const user = await repository.getOrCreateUser(chatId);
                const parsedProxies = parseProxies(msg.text);

                if (parsedProxies.length === 0) {
                    await this.bot.sendMessage(
                        chatId,
                        "⚠️ Прокси не распознан. Пожалуйста, убедитесь, что это валидный прокси в формате ip:port или ip:port:username:password"
                    );
                    return;
                }

                const proxy = parsedProxies[0];

                // Update proxy
                await repository.updateProxy(userState.data.proxyId, user.id, {
                    ipAddress: proxy.ipAddress,
                    port: proxy.port,
                    username: proxy.username,
                    password: proxy.password,
                });

                delete this.userStates[chatId];

                await this.bot.sendMessage(
                    chatId,
                    "✅ Прокси успешно обновлен.",
                    { reply_markup: Keyboard.getMainKeyboard() }
                );
            } catch (error) {
                await this.bot.sendMessage(
                    chatId,
                    `❌ Ошибка при обновлении прокси: ${error.message}`
                );
            }
        }
    }

    private async handleCallbackQuery(query: TelegramBot.CallbackQuery) {
        if (!query.message || !query.data) return;

        const chatId = query.message.chat.id.toString();

        // Handle proxy type selection
        if (query.data.startsWith("proxy_type_")) {
            const parts = query.data.split("_");
            const proxyType = parts[2] as ProxyType;
            const proxyCount = parseInt(parts[3]);

            const userState = this.userStates[chatId];
            if (
                !userState ||
                !userState.data ||
                !userState.data.parsedProxies
            ) {
                await this.bot.sendMessage(
                    chatId,
                    "❌ Произошла ошибка. Пожалуйста, попробуйте снова."
                );
                return;
            }

            const { parsedProxies, availableSlots } = userState.data;
            const user = await repository.getOrCreateUser(chatId);

            // Add proxies up to the limit
            const proxiesToAdd = parsedProxies.slice(0, availableSlots);
            let addedCount = 0;

            for (const proxy of proxiesToAdd) {
                try {
                    await repository.addProxy(
                        user.id,
                        proxy.ipAddress,
                        proxy.port,
                        proxyType,
                        proxy.username,
                        proxy.password
                    );
                    addedCount++;
                } catch (error) {
                    console.error("Error adding proxy:", error);
                }
            }

            // Clear user state
            delete this.userStates[chatId];

            await this.bot.sendMessage(
                chatId,
                `✅ Добавлено ${addedCount} из ${proxyCount} прокси с типом ${proxyType}.` +
                    (proxyCount > addedCount
                        ? ` Достигнут лимит в ${CONFIG.app.maxProxiesPerUser} прокси.`
                        : ""),
                { reply_markup: Keyboard.getMainKeyboard() }
            );
        }

        // Handle proxy selection for editing
        else if (query.data.startsWith("proxy_")) {
            const proxyId = query.data.replace("proxy_", "");

            try {
                const user = await repository.getOrCreateUser(chatId);
                const proxies = await repository.getUserProxies(user.id);
                const selectedProxy = proxies.find(
                    (proxy) => proxy.id === proxyId
                );

                if (!selectedProxy) {
                    await this.bot.sendMessage(chatId, "❌ Прокси не найден.");
                    return;
                }

                const proxyDetails =
                    `${selectedProxy.ipAddress}:${selectedProxy.port}` +
                    (selectedProxy.username
                        ? `:${selectedProxy.username}:${selectedProxy.password}`
                        : "");

                await this.bot.sendMessage(
                    chatId,
                    `Выбран прокси: ${proxyDetails}\n` +
                        `Тип: ${selectedProxy.type}\n\n` +
                        `Что вы хотите сделать?`,
                    {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    {
                                        text: "✏️ Редактировать",
                                        callback_data: `edit_proxy_${proxyId}`,
                                    },
                                    {
                                        text: "🗑️ Удалить",
                                        callback_data: `confirm_delete_proxy_${proxyId}`,
                                    },
                                ],
                                [
                                    {
                                        text: "🔙 Назад",
                                        callback_data: "back_to_proxies",
                                    },
                                ],
                            ],
                        },
                    }
                );
            } catch (error) {
                await this.bot.sendMessage(
                    chatId,
                    `❌ Ошибка: ${error.message}`
                );
            }
        }

        // Handle edit proxy action
        else if (query.data.startsWith("edit_proxy_")) {
            const proxyId = query.data.replace("edit_proxy_", "");

            this.userStates[chatId] = {
                action: "edit_proxy",
                data: { proxyId },
            };

            await this.bot.sendMessage(
                chatId,
                "Отправьте новый прокси в формате ip:port или ip:port:username:password:",
                { reply_markup: Keyboard.getCancelKeyboard() }
            );
        }

        // Handle confirm delete proxy
        else if (query.data.startsWith("confirm_delete_proxy_")) {
            const proxyId = query.data.replace("confirm_delete_proxy_", "");

            await this.bot.sendMessage(
                chatId,
                "Вы уверены, что хотите удалить этот прокси?",
                {
                    reply_markup: Keyboard.getYesNoKeyboard(
                        "delete_proxy",
                        proxyId
                    ),
                }
            );
        }

        // Handle delete proxy confirmation
        else if (query.data.startsWith("delete_proxy_yes_")) {
            const proxyId = query.data.replace("delete_proxy_yes_", "");

            try {
                const user = await repository.getOrCreateUser(chatId);
                await repository.deleteProxy(proxyId, user.id);

                await this.bot.sendMessage(
                    chatId,
                    "✅ Прокси успешно удален.",
                    { reply_markup: Keyboard.getMainKeyboard() }
                );
            } catch (error) {
                await this.bot.sendMessage(
                    chatId,
                    `❌ Ошибка при удалении прокси: ${error.message}`
                );
            }
        }

        // Handle delete proxy cancellation
        else if (query.data.startsWith("delete_proxy_no_")) {
            await this.bot.sendMessage(chatId, "✅ Удаление отменено.", {
                reply_markup: Keyboard.getMainKeyboard(),
            });
        }

        // Handle delete all proxies
        else if (query.data === "delete_all_proxies") {
            await this.bot.sendMessage(
                chatId,
                "⚠️ Вы уверены, что хотите удалить ВСЕ прокси? Это действие нельзя отменить.",
                {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: "✅ Да, удалить все",
                                    callback_data: "confirm_delete_all_proxies",
                                },
                                { text: "❌ Отмена", callback_data: "cancel" },
                            ],
                        ],
                    },
                }
            );
        }

        // Handle confirm delete all proxies
        else if (query.data === "confirm_delete_all_proxies") {
            try {
                const user = await repository.getOrCreateUser(chatId);
                const proxies = await repository.getUserProxies(user.id);

                for (const proxy of proxies) {
                    await repository.deleteProxy(proxy.id, user.id);
                }

                await this.bot.sendMessage(
                    chatId,
                    `✅ Все прокси удалены (${proxies.length}).`,
                    { reply_markup: Keyboard.getMainKeyboard() }
                );
            } catch (error) {
                await this.bot.sendMessage(
                    chatId,
                    `❌ Ошибка при удалении прокси: ${error.message}`
                );
            }
        }

        // Handle back to proxies list
        else if (query.data === "back_to_proxies") {
            try {
                const user = await repository.getOrCreateUser(chatId);
                const proxies = await repository.getUserProxies(user.id);

                if (proxies.length === 0) {
                    await this.bot.sendMessage(
                        chatId,
                        "⚠️ У вас нет добавленных прокси.",
                        { reply_markup: Keyboard.getMainKeyboard() }
                    );
                    return;
                }

                await this.bot.sendMessage(
                    chatId,
                    "Выберите прокси для редактирования:",
                    { reply_markup: Keyboard.getProxiesKeyboard(proxies) }
                );
            } catch (error) {
                await this.bot.sendMessage(
                    chatId,
                    `❌ Ошибка: ${error.message}`
                );
            }
        }

        // Handle Pagination
        else if (query.data.startsWith("proxies_page_")) {
            const proxyPage = query.data.replace("proxies_page_", "");
            try {
                const user = await repository.getOrCreateUser(chatId);
                const proxies = await repository.getUserProxies(user.id);

                if (proxies.length === 0) {
                    await this.bot.sendMessage(
                        chatId,
                        "⚠️ У вас нет добавленных прокси.",
                        { reply_markup: Keyboard.getMainKeyboard() }
                    );
                    return;
                }

                await this.bot.sendMessage(
                    chatId,
                    "Выберите прокси для редактирования:",
                    {
                        reply_markup: Keyboard.getProxiesKeyboard(
                            proxies,
                            +proxyPage
                        ),
                    }
                );
            } catch (error) {
                await this.bot.sendMessage(
                    chatId,
                    `❌ Ошибка: ${error.message}`
                );
            }
        }

        // Always answer callback query to remove loading state
        await this.bot.answerCallbackQuery(query.id);
    }
}
