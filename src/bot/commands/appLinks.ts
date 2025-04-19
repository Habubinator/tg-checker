import TelegramBot from "node-telegram-bot-api";
import { repository } from "../../db/repository";
import { Keyboard } from "../keyboard";
import { parseGooglePlayLinks } from "../../utils/parser";
import { CONFIG } from "../../config";

export class AppLinksCommands {
    private bot: TelegramBot;
    private userStates: Record<string, { action: string; data?: any }> = {};

    constructor(bot: TelegramBot) {
        this.bot = bot;
    }

    registerHandlers() {
        // Handle button clicks
        this.bot.onText(/📌 Добавить ссылки/, this.handleAddLinks.bind(this));
        this.bot.onText(
            /📋 Редактировать ссылки/,
            this.handleEditLinks.bind(this)
        );
        this.bot.onText(/❌ Удалить ссылки/, this.handleDeleteLinks.bind(this));

        // Handle message input for adding links
        this.bot.on("message", this.handleUserInput.bind(this));

        // Handle callback queries for editing/deleting links
        this.bot.on("callback_query", this.handleCallbackQuery.bind(this));
    }

    private async handleAddLinks(msg: TelegramBot.Message) {
        const chatId = msg.chat.id.toString();

        // Get user
        const user = await repository.getOrCreateUser(
            chatId,
            msg.chat.username,
            msg.chat.first_name,
            msg.chat.last_name
        );

        // Check if user has reached the maximum number of links
        const userLinks = await repository.getUserAppLinks(user.id);
        if (userLinks.length >= CONFIG.app.maxLinksPerUser) {
            await this.bot.sendMessage(
                chatId,
                `⚠️ Вы достигли максимального количества ссылок (${CONFIG.app.maxLinksPerUser}). Удалите некоторые ссылки перед добавлением новых.`
            );
            return;
        }

        // Set user state
        this.userStates[chatId] = { action: "add_links" };

        await this.bot.sendMessage(
            chatId,
            "Пожалуйста, отправьте ссылки на приложения Google Play (по одной на строку):",
            { reply_markup: Keyboard.getCancelKeyboard() }
        );
    }

    private async handleEditLinks(msg: TelegramBot.Message) {
        const chatId = msg.chat.id.toString();

        // Get user
        const user = await repository.getOrCreateUser(
            chatId,
            msg.chat.username,
            msg.chat.first_name,
            msg.chat.last_name
        );

        // Get user links
        const links = await repository.getUserAppLinks(user.id);

        if (links.length === 0) {
            await this.bot.sendMessage(
                chatId,
                "⚠️ У вас нет добавленных ссылок."
            );
            return;
        }

        await this.bot.sendMessage(
            chatId,
            "Выберите ссылку для редактирования:",
            { reply_markup: Keyboard.getLinksKeyboard(links) }
        );
    }

    private async handleDeleteLinks(msg: TelegramBot.Message) {
        const chatId = msg.chat.id.toString();

        // Get user
        const user = await repository.getOrCreateUser(
            chatId,
            msg.chat.username,
            msg.chat.first_name,
            msg.chat.last_name
        );

        // Get user links
        const links = await repository.getUserAppLinks(user.id);

        if (links.length === 0) {
            await this.bot.sendMessage(
                chatId,
                "⚠️ У вас нет добавленных ссылок."
            );
            return;
        }

        // Set user state
        this.userStates[chatId] = { action: "delete_links" };

        await this.bot.sendMessage(
            chatId,
            "Выберите ссылку для удаления или удалите все:",
            {
                reply_markup: {
                    inline_keyboard: [
                        ...Keyboard.getLinksKeyboard(links).inline_keyboard,
                        [
                            {
                                text: "🗑️ Удалить все",
                                callback_data: "delete_all_links",
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

        // Handle adding links
        if (userState.action === "add_links") {
            const parsedLinks = parseGooglePlayLinks(msg.text);

            if (parsedLinks.length === 0) {
                await this.bot.sendMessage(
                    chatId,
                    "⚠️ Не найдено действительных ссылок Google Play. Пожалуйста, убедитесь, что ссылки имеют формат: https://play.google.com/store/apps/details?id=com.example.app"
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

            // Get current links count
            const userLinks = await repository.getUserAppLinks(user.id);
            const availableSlots =
                CONFIG.app.maxLinksPerUser - userLinks.length;

            if (availableSlots <= 0) {
                await this.bot.sendMessage(
                    chatId,
                    `⚠️ Вы достигли максимального количества ссылок (${CONFIG.app.maxLinksPerUser}). Удалите некоторые ссылки перед добавлением новых.`
                );
                return;
            }

            // Add links up to the limit
            const linksToAdd = parsedLinks.slice(0, availableSlots);
            let addedCount = 0;

            for (const link of linksToAdd) {
                try {
                    await repository.addAppLink(
                        user.id,
                        link.url,
                        link.packageName
                    );
                    addedCount++;
                } catch (error) {
                    console.error("Error adding link:", error);
                }
            }

            // Clear user state
            delete this.userStates[chatId];

            await this.bot.sendMessage(
                chatId,
                `✅ Добавлено ${addedCount} из ${parsedLinks.length} ссылок.` +
                    (parsedLinks.length > addedCount
                        ? ` Достигнут лимит в ${CONFIG.app.maxLinksPerUser} ссылок.`
                        : ""),
                { reply_markup: Keyboard.getMainKeyboard() }
            );
            return;
        }

        // Handle editing link
        if (userState.action === "edit_link" && userState.data) {
            try {
                const user = await repository.getOrCreateUser(
                    chatId,
                    msg.chat.username,
                    msg.chat.first_name,
                    msg.chat.last_name
                );
                const parsedLinks = parseGooglePlayLinks(msg.text);

                if (parsedLinks.length === 0) {
                    await this.bot.sendMessage(
                        chatId,
                        "⚠️ Ссылка не распознана. Пожалуйста, убедитесь, что это валидная ссылка Google Play."
                    );
                    return;
                }

                const link = parsedLinks[0];
                await repository.updateAppLink(userState.data.linkId, user.id, {
                    url: link.url,
                    packageName: link.packageName,
                });

                delete this.userStates[chatId];

                await this.bot.sendMessage(
                    chatId,
                    "✅ Ссылка успешно обновлена.",
                    { reply_markup: Keyboard.getMainKeyboard() }
                );
            } catch (error) {
                await this.bot.sendMessage(
                    chatId,
                    `❌ Ошибка при обновлении ссылки: ${error.message}`
                );
            }
        }
    }

    private async handleCallbackQuery(query: TelegramBot.CallbackQuery) {
        if (!query.message || !query.data) return;

        const chatId = query.message.chat.id.toString();

        // Handle link selection for editing
        if (query.data.startsWith("link_")) {
            const linkId = query.data.replace("link_", "");

            try {
                const user = await repository.getOrCreateUser(chatId);
                const links = await repository.getUserAppLinks(user.id);
                const selectedLink = links.find((link) => link.id === linkId);

                if (!selectedLink) {
                    await this.bot.sendMessage(chatId, "❌ Ссылка не найдена.");
                    return;
                }

                await this.bot.sendMessage(
                    chatId,
                    `Выбрана ссылка: ${selectedLink.packageName}\n` +
                        `URL: ${selectedLink.url}\n\n` +
                        `Что вы хотите сделать?`,
                    {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    {
                                        text: "✏️ Редактировать",
                                        callback_data: `edit_link_${linkId}`,
                                    },
                                    {
                                        text: "🗑️ Удалить",
                                        callback_data: `confirm_delete_link_${linkId}`,
                                    },
                                ],
                                [
                                    {
                                        text: "🔙 Назад",
                                        callback_data: "back_to_links",
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

        // Handle edit link action
        else if (query.data.startsWith("edit_link_")) {
            const linkId = query.data.replace("edit_link_", "");

            this.userStates[chatId] = {
                action: "edit_link",
                data: { linkId },
            };

            await this.bot.sendMessage(
                chatId,
                "Отправьте новую ссылку для приложения:",
                { reply_markup: Keyboard.getCancelKeyboard() }
            );
        }

        // Handle confirm delete link
        else if (query.data.startsWith("confirm_delete_link_")) {
            const linkId = query.data.replace("confirm_delete_link_", "");

            await this.bot.sendMessage(
                chatId,
                "Вы уверены, что хотите удалить эту ссылку?",
                {
                    reply_markup: Keyboard.getYesNoKeyboard(
                        "delete_link",
                        linkId
                    ),
                }
            );
        }

        // Handle delete link confirmation
        else if (query.data.startsWith("delete_link_yes_")) {
            const linkId = query.data.replace("delete_link_yes_", "");

            try {
                const user = await repository.getOrCreateUser(chatId);
                await repository.deleteAppLink(linkId, user.id);

                await this.bot.sendMessage(
                    chatId,
                    "✅ Ссылка успешно удалена.",
                    { reply_markup: Keyboard.getMainKeyboard() }
                );
            } catch (error) {
                await this.bot.sendMessage(
                    chatId,
                    `❌ Ошибка при удалении ссылки: ${error.message}`
                );
            }
        }

        // Handle delete link cancellation
        else if (query.data.startsWith("delete_link_no_")) {
            await this.bot.sendMessage(chatId, "✅ Удаление отменено.", {
                reply_markup: Keyboard.getMainKeyboard(),
            });
        }

        // Handle delete all links
        else if (query.data === "delete_all_links") {
            await this.bot.sendMessage(
                chatId,
                "⚠️ Вы уверены, что хотите удалить ВСЕ ссылки? Это действие нельзя отменить.",
                {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: "✅ Да, удалить все",
                                    callback_data: "confirm_delete_all_links",
                                },
                                { text: "❌ Отмена", callback_data: "cancel" },
                            ],
                        ],
                    },
                }
            );
        }

        // Handle confirm delete all links
        else if (query.data === "confirm_delete_all_links") {
            try {
                const user = await repository.getOrCreateUser(chatId);
                const links = await repository.getUserAppLinks(user.id);

                for (const link of links) {
                    await repository.deleteAppLink(link.id, user.id);
                }

                await this.bot.sendMessage(
                    chatId,
                    `✅ Все ссылки удалены (${links.length}).`,
                    { reply_markup: Keyboard.getMainKeyboard() }
                );
            } catch (error) {
                await this.bot.sendMessage(
                    chatId,
                    `❌ Ошибка при удалении ссылок: ${error.message}`
                );
            }
        }

        // Handle back to links list
        else if (query.data === "back_to_links") {
            try {
                const user = await repository.getOrCreateUser(chatId);
                const links = await repository.getUserAppLinks(user.id);

                if (links.length === 0) {
                    await this.bot.sendMessage(
                        chatId,
                        "⚠️ У вас нет добавленных ссылок.",
                        { reply_markup: Keyboard.getMainKeyboard() }
                    );
                    return;
                }

                await this.bot.sendMessage(
                    chatId,
                    "Выберите ссылку для редактирования:",
                    { reply_markup: Keyboard.getLinksKeyboard(links) }
                );
            } catch (error) {
                await this.bot.sendMessage(
                    chatId,
                    `❌ Ошибка: ${error.message}`
                );
            }
        }

        // Handle cancel
        else if (query.data === "cancel") {
            await this.bot.sendMessage(chatId, "✅ Действие отменено.", {
                reply_markup: Keyboard.getMainKeyboard(),
            });
        }

        // Always answer callback query to remove loading state
        await this.bot.answerCallbackQuery(query.id);
    }
}
