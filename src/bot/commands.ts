import TelegramBot, { Message } from "node-telegram-bot-api";
import { prisma } from "../database/prisma.database";
import { UserState } from "../types";
import { googlePlayChecker } from "../services/googlePlayChecker";
import { proxyService } from "../services/proxyService";
import { schedulerService } from "../services/schedulerService";

// Store user states
const userStates: Record<number, UserState> = {};

export const initCommands = (bot: TelegramBot) => {
    // Register all bot commands
    bot.setMyCommands([
        { command: "/start", description: "Запустить бота" },
        { command: "/menu", description: "Открыть главное меню" },
        { command: "/help", description: "Показать помощь" },
    ]);

    // Start command
    bot.onText(/\/start/, async (msg) => {
        const chatId = msg.chat.id;
        await handleStart(bot, msg);
    });

    // Menu command
    bot.onText(/\/menu/, async (msg) => {
        const chatId = msg.chat.id;
        await showMainMenu(bot, msg);
    });

    // Help command
    bot.onText(/\/help/, async (msg) => {
        const chatId = msg.chat.id;
        await bot.sendMessage(
            chatId,
            "Это бот для проверки доступности приложений в Google Play.\n\n" +
                "Основные команды:\n" +
                "/menu - открыть главное меню\n" +
                "/help - показать эту справку\n\n" +
                "Для начала работы добавьте ссылки на приложения и прокси через меню бота."
        );
    });

    // Handle callback queries
    bot.on("callback_query", async (query) => {
        if (!query.message) return;

        const chatId = query.message.chat.id;
        const userId = query.from.id;
        const data = query.data || "";

        try {
            await bot.answerCallbackQuery(query.id);

            switch (data) {
                case "main_menu":
                    await showMainMenu(bot, query.message, userId);
                    break;
                case "add_links":
                    await handleAddLinks(bot, query.message, userId);
                    break;
                case "edit_links":
                    await handleEditLinks(bot, query.message, userId);
                    break;
                case "delete_links":
                    await handleDeleteLinks(bot, query.message, userId);
                    break;
                case "add_proxies":
                    await handleAddProxies(bot, query.message, userId);
                    break;
                case "edit_proxies":
                    await handleEditProxies(bot, query.message, userId);
                    break;
                case "delete_proxies":
                    await handleDeleteProxies(bot, query.message, userId);
                    break;
                case "check_timing":
                    await handleCheckTiming(bot, query.message, userId);
                    break;
                case "run_check":
                    await handleRunCheck(bot, query.message, userId);
                    break;
                case "check_status":
                    await handleCheckStatus(bot, query.message, userId);
                    break;
                default:
                    // Handle dynamic callbacks
                    if (data.startsWith("delete_link_")) {
                        const linkId = data.replace("delete_link_", "");
                        await deleteLinkById(
                            bot,
                            query.message,
                            userId,
                            linkId
                        );
                    } else if (data.startsWith("delete_proxy_")) {
                        const proxyId = data.replace("delete_proxy_", "");
                        await deleteProxyById(
                            bot,
                            query.message,
                            userId,
                            proxyId
                        );
                    } else if (data.startsWith("edit_link_")) {
                        const linkId = data.replace("edit_link_", "");
                        await editLinkById(bot, query.message, userId, linkId);
                    } else if (data.startsWith("edit_proxy_")) {
                        const proxyId = data.replace("edit_proxy_", "");
                        await editProxyById(
                            bot,
                            query.message,
                            userId,
                            proxyId
                        );
                    } else if (data.startsWith("add_timing_")) {
                        await addCheckTiming(bot, query.message, userId);
                    } else if (data.startsWith("delete_timing_")) {
                        const timeId = data.replace("delete_timing_", "");
                        await deleteCheckTiming(
                            bot,
                            query.message,
                            userId,
                            timeId
                        );
                    } else if (data === "cancel") {
                        delete userStates[userId];
                        await showMainMenu(bot, query.message, userId);
                    }
            }
        } catch (error) {
            console.error("Error handling callback query:", error);
            await bot.sendMessage(
                chatId,
                "❌ Произошла ошибка при обработке запроса."
            );
        }
    });

    // Handle text messages
    bot.on("message", async (msg) => {
        if (!msg.text || msg.text.startsWith("/")) return;

        const chatId = msg.chat.id;
        const userId = msg.from?.id;

        if (!userId) return;

        const state = userStates[userId];
        if (!state) return;

        try {
            switch (state.step) {
                case "adding_links":
                    await processAddLinks(bot, msg, userId);
                    break;
                case "adding_proxies":
                    await processAddProxies(bot, msg, userId);
                    break;
                case "editing_link":
                    await processEditLink(bot, msg, userId);
                    break;
                case "editing_proxy":
                    await processEditProxy(bot, msg, userId);
                    break;
                case "adding_timing":
                    await processAddTiming(bot, msg, userId);
                    break;
            }
        } catch (error) {
            console.error("Error handling message:", error);
            await bot.sendMessage(
                chatId,
                "❌ Произошла ошибка при обработке сообщения."
            );
        }
    });
};

// Handle the start command
import TelegramBot, { Message } from "node-telegram-bot-api";
import { prisma } from "../database/prisma.database";
import { UserState } from "../types";
import { googlePlayChecker } from "../services/googlePlayChecker";
import { proxyService } from "../services/proxyService";
import { schedulerService } from "../services/schedulerService";

// Store user states
const userStates: Record<number, UserState> = {};

export const initCommands = (bot: TelegramBot) => {
    // Register all bot commands
    bot.setMyCommands([
        { command: "/start", description: "Запустить бота" },
        { command: "/menu", description: "Открыть главное меню" },
        { command: "/help", description: "Показать помощь" },
    ]);

    // Start command
    bot.onText(/\/start/, async (msg) => {
        const chatId = msg.chat.id;
        await handleStart(bot, msg);
    });

    // Menu command
    bot.onText(/\/menu/, async (msg) => {
        const chatId = msg.chat.id;
        await showMainMenu(bot, msg);
    });

    // Help command
    bot.onText(/\/help/, async (msg) => {
        const chatId = msg.chat.id;
        await bot.sendMessage(
            chatId,
            "Это бот для проверки доступности приложений в Google Play.\n\n" +
                "Основные команды:\n" +
                "/menu - открыть главное меню\n" +
                "/help - показать эту справку\n\n" +
                "Для начала работы добавьте ссылки на приложения и прокси через меню бота."
        );
    });

    // Handle callback queries
    bot.on("callback_query", async (query) => {
        if (!query.message) return;

        const chatId = query.message.chat.id;
        const userId = query.from.id;
        const data = query.data || "";

        try {
            await bot.answerCallbackQuery(query.id);

            switch (data) {
                case "main_menu":
                    await showMainMenu(bot, query.message, userId);
                    break;
                case "add_links":
                    await handleAddLinks(bot, query.message, userId);
                    break;
                case "edit_links":
                    await handleEditLinks(bot, query.message, userId);
                    break;
                case "delete_links":
                    await handleDeleteLinks(bot, query.message, userId);
                    break;
                case "add_proxies":
                    await handleAddProxies(bot, query.message, userId);
                    break;
                case "edit_proxies":
                    await handleEditProxies(bot, query.message, userId);
                    break;
                case "delete_proxies":
                    await handleDeleteProxies(bot, query.message, userId);
                    break;
                case "check_timing":
                    await handleCheckTiming(bot, query.message, userId);
                    break;
                case "run_check":
                    await handleRunCheck(bot, query.message, userId);
                    break;
                case "check_status":
                    await handleCheckStatus(bot, query.message, userId);
                    break;
                default:
                    // Handle dynamic callbacks
                    if (data.startsWith("delete_link_")) {
                        const linkId = data.replace("delete_link_", "");
                        await deleteLinkById(
                            bot,
                            query.message,
                            userId,
                            linkId
                        );
                    } else if (data.startsWith("delete_proxy_")) {
                        const proxyId = data.replace("delete_proxy_", "");
                        await deleteProxyById(
                            bot,
                            query.message,
                            userId,
                            proxyId
                        );
                    } else if (data.startsWith("edit_link_")) {
                        const linkId = data.replace("edit_link_", "");
                        await editLinkById(bot, query.message, userId, linkId);
                    } else if (data.startsWith("edit_proxy_")) {
                        const proxyId = data.replace("edit_proxy_", "");
                        await editProxyById(
                            bot,
                            query.message,
                            userId,
                            proxyId
                        );
                    } else if (data.startsWith("add_timing_")) {
                        await addCheckTiming(bot, query.message, userId);
                    } else if (data.startsWith("delete_timing_")) {
                        const timeId = data.replace("delete_timing_", "");
                        await deleteCheckTiming(
                            bot,
                            query.message,
                            userId,
                            timeId
                        );
                    } else if (data === "cancel") {
                        delete userStates[userId];
                        await showMainMenu(bot, query.message, userId);
                    }
            }
        } catch (error) {
            console.error("Error handling callback query:", error);
            await bot.sendMessage(
                chatId,
                "❌ Произошла ошибка при обработке запроса."
            );
        }
    });

    // Handle text messages
    bot.on("message", async (msg) => {
        if (!msg.text || msg.text.startsWith("/")) return;

        const chatId = msg.chat.id;
        const userId = msg.from?.id;

        if (!userId) return;

        const state = userStates[userId];
        if (!state) return;

        try {
            switch (state.step) {
                case "adding_links":
                    await processAddLinks(bot, msg, userId);
                    break;
                case "adding_proxies":
                    await processAddProxies(bot, msg, userId);
                    break;
                case "editing_link":
                    await processEditLink(bot, msg, userId);
                    break;
                case "editing_proxy":
                    await processEditProxy(bot, msg, userId);
                    break;
                case "adding_timing":
                    await processAddTiming(bot, msg, userId);
                    break;
            }
        } catch (error) {
            console.error("Error handling message:", error);
            await bot.sendMessage(
                chatId,
                "❌ Произошла ошибка при обработке сообщения."
            );
        }
    });
};

// Handle the start command
// Handle the start command
async function handleStart(bot: TelegramBot, msg: Message) {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;

    if (!userId) return;

    try {
        // Check if user already exists
        let user = await prisma.user.findUnique({
            where: { telegramId: userId.toString() },
        });

        if (!user) {
            // Create new user
            user = await prisma.user.create({
                data: {
                    telegramId: userId.toString(),
                    username: msg.from?.username,
                    firstName: msg.from?.first_name,
                    lastName: msg.from?.last_name,
                },
            });
        }

        // Welcome message
        await bot.sendMessage(
            chatId,
            `👋 Привет, ${msg.from?.first_name || "пользователь"}!\n\n` +
                `Я бот-чекер приложений Google Play. С моей помощью вы можете отслеживать доступность приложений через прокси.`
        );

        // Show main menu
        await showMainMenu(bot, msg, userId);
    } catch (error) {
        console.error("Error in start handler:", error);
        await bot.sendMessage(chatId, "❌ Произошла ошибка при запуске бота.");
    }
}

// Show the main menu
async function showMainMenu(bot: TelegramBot, msg: Message, userId?: number) {
    const chatId = msg.chat.id;

    // If userId is provided, clear the user state
    if (userId) {
        delete userStates[userId];
    }

    await bot.sendMessage(chatId, "📱 Главное меню", {
        reply_markup: {
            inline_keyboard: [
                [{ text: "➕ Добавить ссылки", callback_data: "add_links" }],
                [
                    {
                        text: "✏️ Редактировать ссылки",
                        callback_data: "edit_links",
                    },
                ],
                [{ text: "🗑️ Удалить ссылки", callback_data: "delete_links" }],
                [{ text: "➕ Добавить прокси", callback_data: "add_proxies" }],
                [
                    {
                        text: "✏️ Редактировать прокси",
                        callback_data: "edit_proxies",
                    },
                ],
                [
                    {
                        text: "🗑️ Удалить прокси",
                        callback_data: "delete_proxies",
                    },
                ],
                [
                    {
                        text: "⏰ Тайминг проверок",
                        callback_data: "check_timing",
                    },
                ],
                [{ text: "🚀 Запустить проверку", callback_data: "run_check" }],
                [{ text: "📊 Статус проверки", callback_data: "check_status" }],
            ],
        },
    });
}

// Handle add links request
async function handleAddLinks(bot: TelegramBot, msg: Message, userId: number) {
    const chatId = msg.chat.id;

    userStates[userId] = {
        step: "adding_links",
        chatId,
    };

    await bot.sendMessage(
        chatId,
        "📝 Пожалуйста, отправьте ссылки на приложения Google Play.\n\n" +
            "Вы можете отправить несколько ссылок, каждую с новой строки.\n\n" +
            "Пример:\n" +
            "https://play.google.com/store/apps/details?id=com.example.app1\n" +
            "https://play.google.com/store/apps/details?id=com.example.app2",
        {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "❌ Отмена", callback_data: "cancel" }],
                ],
            },
        }
    );
}

// Process add links message
async function processAddLinks(bot: TelegramBot, msg: Message, userId: number) {
    const chatId = msg.chat.id;
    const text = msg.text || "";

    // Get user id from database
    const user = await prisma.user.findUnique({
        where: { telegramId: userId.toString() },
    });

    if (!user) {
        await bot.sendMessage(
            chatId,
            "❌ Пользователь не найден. Используйте /start для начала работы."
        );
        return;
    }

    // Extract links from the message
    const links = text
        .split("\n")
        .map((link) => link.trim())
        .filter((link) =>
            link.startsWith("https://play.google.com/store/apps/details?id=")
        );

    if (links.length === 0) {
        await bot.sendMessage(
            chatId,
            "❌ Не найдено корректных ссылок на Google Play.\n\n" +
                "Ссылки должны иметь формат:\n" +
                "https://play.google.com/store/apps/details?id=com.example.app",
            {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "❌ Отмена", callback_data: "cancel" }],
                    ],
                },
            }
        );
        return;
    }

    // Process each link
    let addedCount = 0;
    let existingCount = 0;
    let errorCount = 0;

    for (const link of links) {
        try {
            // Extract package name from link
            const packageNameMatch = link.match(/id=([^&]+)/);
            if (!packageNameMatch) {
                errorCount++;
                continue;
            }

            const packageName = packageNameMatch[1];

            // Check if link already exists
            const existingLink = await prisma.appLink.findFirst({
                where: {
                    userId: user.id,
                    packageName,
                },
            });

            if (existingLink) {
                existingCount++;
                continue;
            }

            // Add the link
            await prisma.appLink.create({
                data: {
                    url: link,
                    packageName,
                    userId: user.id,
                },
            });

            addedCount++;
        } catch (error) {
            console.error("Error adding link:", error);
            errorCount++;
        }
    }

    // Clear user state
    delete userStates[userId];

    // Report result
    await bot.sendMessage(
        chatId,
        `✅ Обработка ссылок завершена:\n\n` +
            `- Добавлено: ${addedCount}\n` +
            `- Уже существуют: ${existingCount}\n` +
            `- Ошибки: ${errorCount}`,
        {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: "📱 Вернуться в главное меню",
                            callback_data: "main_menu",
                        },
                    ],
                ],
            },
        }
    );
}

// Handle edit links request
async function handleEditLinks(bot: TelegramBot, msg: Message, userId: number) {
    const chatId = msg.chat.id;

    // Get user id from database
    const user = await prisma.user.findUnique({
        where: { telegramId: userId.toString() },
    });

    if (!user) {
        await bot.sendMessage(
            chatId,
            "❌ Пользователь не найден. Используйте /start для начала работы."
        );
        return;
    }

    // Get all links for this user
    const links = await prisma.appLink.findMany({
        where: { userId: user.id },
    });

    if (links.length === 0) {
        await bot.sendMessage(
            chatId,
            "❌ У вас нет добавленных ссылок.\n\n" +
                'Используйте "Добавить ссылки" в главном меню, чтобы добавить ссылки на приложения.',
            {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: "📱 Вернуться в главное меню",
                                callback_data: "main_menu",
                            },
                        ],
                    ],
                },
            }
        );
        return;
    }

    // Create inline keyboard with links
    const keyboard = links.map((link) => [
        { text: link.packageName, callback_data: `edit_link_${link.id}` },
    ]);

    // Add back button
    keyboard.push([
        { text: "📱 Вернуться в главное меню", callback_data: "main_menu" },
    ]);

    await bot.sendMessage(chatId, "✏️ Выберите ссылку для редактирования:", {
        reply_markup: {
            inline_keyboard: keyboard,
        },
    });
}

// Edit specific link
async function editLinkById(
    bot: TelegramBot,
    msg: Message,
    userId: number,
    linkId: string
) {
    const chatId = msg.chat.id;

    // Get link details
    const link = await prisma.appLink.findUnique({
        where: { id: linkId },
    });

    if (!link) {
        await bot.sendMessage(chatId, "❌ Ссылка не найдена.");
        return;
    }

    // Set user state to editing this link
    userStates[userId] = {
        step: "editing_link",
        chatId,
        editingLinkId: linkId,
        tempData: link,
    };

    await bot.sendMessage(
        chatId,
        `🔄 Редактирование ссылки:\n\n` +
            `Текущий URL: ${link.url}\n` +
            `Package Name: ${link.packageName}\n\n` +
            `Отправьте новый URL для этого приложения:`,
        {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "❌ Отмена", callback_data: "cancel" }],
                ],
            },
        }
    );
}

// Process edit link message
async function processEditLink(bot: TelegramBot, msg: Message, userId: number) {
    const chatId = msg.chat.id;
    const text = msg.text || "";
    const state = userStates[userId];

    if (!state || !state.editingLinkId) {
        delete userStates[userId];
        await bot.sendMessage(
            chatId,
            "❌ Произошла ошибка. Вернитесь в главное меню."
        );
        return;
    }

    // Validate link format
    if (!text.startsWith("https://play.google.com/store/apps/details?id=")) {
        await bot.sendMessage(
            chatId,
            "❌ Некорректная ссылка.\n\n" +
                "Ссылка должна иметь формат:\n" +
                "https://play.google.com/store/apps/details?id=com.example.app",
            {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "❌ Отмена", callback_data: "cancel" }],
                    ],
                },
            }
        );
        return;
    }

    try {
        // Extract package name from link
        const packageNameMatch = text.match(/id=([^&]+)/);
        if (!packageNameMatch) {
            await bot.sendMessage(
                chatId,
                "❌ Не удалось извлечь package name из ссылки."
            );
            return;
        }

        const packageName = packageNameMatch[1];

        // Update link in database
        await prisma.appLink.update({
            where: { id: state.editingLinkId },
            data: {
                url: text,
                packageName,
            },
        });

        // Clear user state
        delete userStates[userId];

        // Report success
        await bot.sendMessage(
            chatId,
            `✅ Ссылка успешно обновлена:\n\n` +
                `Новый URL: ${text}\n` +
                `Package Name: ${packageName}`,
            {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: "📱 Вернуться в главное меню",
                                callback_data: "main_menu",
                            },
                        ],
                    ],
                },
            }
        );
    } catch (error) {
        console.error("Error updating link:", error);
        await bot.sendMessage(
            chatId,
            "❌ Произошла ошибка при обновлении ссылки."
        );
    }
}

// Handle delete links request
async function handleDeleteLinks(
    bot: TelegramBot,
    msg: Message,
    userId: number
) {
    const chatId = msg.chat.id;

    // Get user id from database
    const user = await prisma.user.findUnique({
        where: { telegramId: userId.toString() },
    });

    if (!user) {
        await bot.sendMessage(
            chatId,
            "❌ Пользователь не найден. Используйте /start для начала работы."
        );
        return;
    }

    // Get all links for this user
    const links = await prisma.appLink.findMany({
        where: { userId: user.id },
    });

    if (links.length === 0) {
        await bot.sendMessage(chatId, "❌ У вас нет добавленных ссылок.", {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: "📱 Вернуться в главное меню",
                            callback_data: "main_menu",
                        },
                    ],
                ],
            },
        });
        return;
    }

    // Create inline keyboard with links
    const keyboard = links.map((link) => [
        {
            text: `🗑️ ${link.packageName}`,
            callback_data: `delete_link_${link.id}`,
        },
    ]);

    // Add back button
    keyboard.push([
        { text: "📱 Вернуться в главное меню", callback_data: "main_menu" },
    ]);

    await bot.sendMessage(chatId, "🗑️ Выберите ссылку для удаления:", {
        reply_markup: {
            inline_keyboard: keyboard,
        },
    });
}

// Delete specific link
async function deleteLinkById(
    bot: TelegramBot,
    msg: Message,
    userId: number,
    linkId: string
) {
    const chatId = msg.chat.id;

    try {
        // Get link details first
        const link = await prisma.appLink.findUnique({
            where: { id: linkId },
        });

        if (!link) {
            await bot.sendMessage(chatId, "❌ Ссылка не найдена.");
            return;
        }

        // Delete link
        await prisma.appLink.delete({
            where: { id: linkId },
        });

        await bot.sendMessage(
            chatId,
            `✅ Ссылка "${link.packageName}" успешно удалена.`,
            {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: "🗑️ Удалить другие ссылки",
                                callback_data: "delete_links",
                            },
                        ],
                        [
                            {
                                text: "📱 Вернуться в главное меню",
                                callback_data: "main_menu",
                            },
                        ],
                    ],
                },
            }
        );
    } catch (error) {
        console.error("Error deleting link:", error);
        await bot.sendMessage(
            chatId,
            "❌ Произошла ошибка при удалении ссылки."
        );
    }
}

// Handle add proxies request
async function handleAddProxies(
    bot: TelegramBot,
    msg: Message,
    userId: number
) {
    const chatId = msg.chat.id;

    userStates[userId] = {
        step: "adding_proxies",
        chatId,
    };

    await bot.sendMessage(
        chatId,
        "📝 Пожалуйста, отправьте список прокси.\n\n" +
            "Вы можете отправить несколько прокси, каждый с новой строки.\n\n" +
            "Поддерживаемые форматы:\n" +
            "ip:port\n" +
            "ip:port:username:password\n\n" +
            "Пример:\n" +
            "123.123.123.123:8080\n" +
            "111.111.111.111:3128:user:pass",
        {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "❌ Отмена", callback_data: "cancel" }],
                ],
            },
        }
    );
}

// Process add proxies message
async function processAddProxies(
    bot: TelegramBot,
    msg: Message,
    userId: number
) {
    const chatId = msg.chat.id;
    const text = msg.text || "";

    // Get user id from database
    const user = await prisma.user.findUnique({
        where: { telegramId: userId.toString() },
    });

    if (!user) {
        await bot.sendMessage(
            chatId,
            "❌ Пользователь не найден. Используйте /start для начала работы."
        );
        return;
    }

    // Extract proxy strings
    const proxyStrings = text
        .split("\n")
        .map((proxy) => proxy.trim())
        .filter((proxy) => proxy.length > 0);

    if (proxyStrings.length === 0) {
        await bot.sendMessage(chatId, "❌ Не найдено корректных прокси.", {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "❌ Отмена", callback_data: "cancel" }],
                ],
            },
        });
        return;
    }

    // Process proxies
    const result = await proxyService.addProxies(user.id, proxyStrings);

    // Clear user state
    delete userStates[userId];

    // Report result
    await bot.sendMessage(
        chatId,
        `✅ Обработка прокси завершена:\n\n` +
            `- Добавлено: ${result.added}\n` +
            `- Некорректный формат: ${result.invalid}`,
        {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: "📱 Вернуться в главное меню",
                            callback_data: "main_menu",
                        },
                    ],
                ],
            },
        }
    );
}

// Handle edit proxies request
async function handleEditProxies(
    bot: TelegramBot,
    msg: Message,
    userId: number
) {
    const chatId = msg.chat.id;

    // Get user id from database
    const user = await prisma.user.findUnique({
        where: { telegramId: userId.toString() },
    });

    if (!user) {
        await bot.sendMessage(
            chatId,
            "❌ Пользователь не найден. Используйте /start для начала работы."
        );
        return;
    }

    // Get all proxies for this user
    const proxies = await prisma.proxy.findMany({
        where: { userId: user.id },
    });

    if (proxies.length === 0) {
        await bot.sendMessage(
            chatId,
            "❌ У вас нет добавленных прокси.\n\n" +
                'Используйте "Добавить прокси" в главном меню, чтобы добавить прокси.',
            {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: "📱 Вернуться в главное меню",
                                callback_data: "main_menu",
                            },
                        ],
                    ],
                },
            }
        );
        return;
    }

    // Create inline keyboard with proxies
    const keyboard = proxies.map((proxy) => {
        const proxyText = proxy.username
            ? `${proxy.ipAddress}:${proxy.port} (Auth)`
            : `${proxy.ipAddress}:${proxy.port}`;
        return [{ text: proxyText, callback_data: `edit_proxy_${proxy.id}` }];
    });

    // Add back button
    keyboard.push([
        { text: "📱 Вернуться в главное меню", callback_data: "main_menu" },
    ]);

    await bot.sendMessage(chatId, "✏️ Выберите прокси для редактирования:", {
        reply_markup: {
            inline_keyboard: keyboard,
        },
    });
}

// Edit specific proxy
async function editProxyById(
    bot: TelegramBot,
    msg: Message,
    userId: number,
    proxyId: string
) {
    const chatId = msg.chat.id;

    // Get proxy details
    const proxy = await prisma.proxy.findUnique({
        where: { id: proxyId },
    });

    if (!proxy) {
        await bot.sendMessage(chatId, "❌ Прокси не найден.");
        return;
    }

    // Set user state to editing this proxy
    userStates[userId] = {
        step: "editing_proxy",
        chatId,
        editingProxyId: proxyId,
    };

    const proxyText =
        proxy.username && proxy.password
            ? `${proxy.ipAddress}:${proxy.port}:${proxy.username}:${proxy.password}`
            : `${proxy.ipAddress}:${proxy.port}`;

    await bot.sendMessage(
        chatId,
        `🔄 Редактирование прокси:\n\n` +
            `Текущий прокси: ${proxyText}\n\n` +
            `Отправьте новый прокси в формате:\n` +
            `ip:port или ip:port:username:password`,
        {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "❌ Отмена", callback_data: "cancel" }],
                ],
            },
        }
    );
}

// Process edit proxy message
async function processEditProxy(
    bot: TelegramBot,
    msg: Message,
    userId: number
) {
    const chatId = msg.chat.id;
    const text = msg.text || "";
    const state = userStates[userId];

    if (!state || !state.editingProxyId) {
        delete userStates[userId];
        await bot.sendMessage(
            chatId,
            "❌ Произошла ошибка. Вернитесь в главное меню."
        );
        return;
    }

    // Parse proxy
    const parsedProxy = proxyService.parseProxyString(text);

    if (!parsedProxy) {
        await bot.sendMessage(
            chatId,
            "❌ Некорректный формат прокси.\n\n" +
                "Прокси должен иметь формат:\n" +
                "ip:port или ip:port:username:password",
            {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "❌ Отмена", callback_data: "cancel" }],
                    ],
                },
            }
        );
        return;
    }

    try {
        // Update proxy in database
        await prisma.proxy.update({
            where: { id: state.editingProxyId },
            data: {
                ipAddress: parsedProxy.ipAddress,
                port: parsedProxy.port,
                username: parsedProxy.username || null,
                password: parsedProxy.password || null,
            },
        });

        // Clear user state
        delete userStates[userId];

        // Format proxy for display
        const proxyText =
            parsedProxy.username && parsedProxy.password
                ? `${parsedProxy.ipAddress}:${parsedProxy.port}:${parsedProxy.username}:${parsedProxy.password}`
                : `${parsedProxy.ipAddress}:${parsedProxy.port}`;

        // Report success
        await bot.sendMessage(
            chatId,
            `✅ Прокси успешно обновлен:\n\n` + `Новый прокси: ${proxyText}`,
            {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: "📱 Вернуться в главное меню",
                                callback_data: "main_menu",
                            },
                        ],
                    ],
                },
            }
        );
    } catch (error) {
        console.error("Error updating proxy:", error);
        await bot.sendMessage(
            chatId,
            "❌ Произошла ошибка при обновлении прокси."
        );
    }
}

// Handle delete proxies request
async function handleDeleteProxies(
    bot: TelegramBot,
    msg: Message,
    userId: number
) {
    const chatId = msg.chat.id;

    // Get user id from database
    const user = await prisma.user.findUnique({
        where: { telegramId: userId.toString() },
    });

    if (!user) {
        await bot.sendMessage(
            chatId,
            "❌ Пользователь не найден. Используйте /start для начала работы."
        );
        return;
    }

    // Get all proxies for this user
    const proxies = await prisma.proxy.findMany({
        where: { userId: user.id },
    });

    if (proxies.length === 0) {
        await bot.sendMessage(chatId, "❌ У вас нет добавленных прокси.", {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: "📱 Вернуться в главное меню",
                            callback_data: "main_menu",
                        },
                    ],
                ],
            },
        });
        return;
    }

    // Create inline keyboard with proxies
    const keyboard = proxies.map((proxy) => {
        const proxyText = proxy.username
            ? `🗑️ ${proxy.ipAddress}:${proxy.port} (Auth)`
            : `🗑️ ${proxy.ipAddress}:${proxy.port}`;
        return [{ text: proxyText, callback_data: `delete_proxy_${proxy.id}` }];
    });

    // Add option to delete all
    keyboard.push([
        { text: "🗑️ Удалить все прокси", callback_data: "delete_all_proxies" },
    ]);

    // Add back button
    keyboard.push([
        { text: "📱 Вернуться в главное меню", callback_data: "main_menu" },
    ]);

    await bot.sendMessage(chatId, "🗑️ Выберите прокси для удаления:", {
        reply_markup: {
            inline_keyboard: keyboard,
        },
    });
}

// Delete specific proxy
async function deleteProxyById(
    bot: TelegramBot,
    msg: Message,
    userId: number,
    proxyId: string
) {
    const chatId = msg.chat.id;

    try {
        // Get proxy details first
        const proxy = await prisma.proxy.findUnique({
            where: { id: proxyId },
        });

        if (!proxy) {
            await bot.sendMessage(chatId, "❌ Прокси не найден.");
            return;
        }

        // Delete proxy
        await prisma.proxy.delete({
            where: { id: proxyId },
        });

        // Format proxy for display
        const proxyText = proxy.username
            ? `${proxy.ipAddress}:${proxy.port} (Auth)`
            : `${proxy.ipAddress}:${proxy.port}`;

        await bot.sendMessage(
            chatId,
            `✅ Прокси "${proxyText}" успешно удален.`,
            {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: "🗑️ Удалить другие прокси",
                                callback_data: "delete_proxies",
                            },
                        ],
                        [
                            {
                                text: "📱 Вернуться в главное меню",
                                callback_data: "main_menu",
                            },
                        ],
                    ],
                },
            }
        );
    } catch (error) {
        console.error("Error deleting proxy:", error);
        await bot.sendMessage(
            chatId,
            "❌ Произошла ошибка при удалении прокси."
        );
    }
}

// Handle check timing settings
async function handleCheckTiming(
    bot: TelegramBot,
    msg: Message,
    userId: number
) {
    const chatId = msg.chat.id;

    // Get user id from database
    const user = await prisma.user.findUnique({
        where: { telegramId: userId.toString() },
    });

    if (!user) {
        await bot.sendMessage(
            chatId,
            "❌ Пользователь не найден. Используйте /start для начала работы."
        );
        return;
    }

    // Get all schedules for this user
    const schedules = await prisma.checkSchedule.findMany({
        where: {
            userId: user.id,
            isActive: true,
        },
        orderBy: { time: "asc" },
    });

    // Create message text
    let message = "⏰ Текущее расписание проверок:\n\n";

    if (schedules.length === 0) {
        message += "Нет активных расписаний проверок.";
    } else {
        schedules.forEach((schedule, index) => {
            message += `${index + 1}. ${schedule.time}\n`;
        });
    }

    // Create keyboard
    const keyboard = [
        [{ text: "➕ Добавить время", callback_data: "add_timing" }],
    ];

    // Add delete buttons for each schedule
    schedules.forEach((schedule) => {
        keyboard.push([
            {
                text: `🗑️ Удалить ${schedule.time}`,
                callback_data: `delete_timing_${schedule.id}`,
            },
        ]);
    });

    // Add back button
    keyboard.push([
        { text: "📱 Вернуться в главное меню", callback_data: "main_menu" },
    ]);

    await bot.sendMessage(chatId, message, {
        reply_markup: {
            inline_keyboard: keyboard,
        },
    });
}
