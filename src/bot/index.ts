import dotenv from "dotenv";
dotenv.config();
import TelegramBot, { CallbackQuery } from "node-telegram-bot-api";
import { prisma } from "@database";
import { callbackHandlers, messageHandler } from "./callback.handlers";

const token = process.env.BOT_TOKEN;
process.env["NTBA_FIX_350"] = "1";
process.env["NTBA_FIX_319"] = "1";

export const bot = new TelegramBot(token, { polling: true });

bot.setMyCommands(
    [
        { command: "/start", description: "Запустить приложение" },
        {
            command: "/credentials",
            description: "Получить данные для логина на сайте",
        },
    ],
    { language_code: "ru" }
);

bot.setMyCommands(
    [
        { command: "/start", description: "Start App" },
        {
            command: "/credentials",
            description: "Recieve login data",
        },
    ],
    { language_code: "ru" }
);

bot.onText(/\/start(.+)?/, async (msg, match) => {
    try {
        const chatId = msg.chat.id;
        const isUserRegistered = await prisma.user.count({
            where: { telegramId: `${msg.from.id}` },
        });

        if (msg.chat.type != "private") {
            return await bot.sendMessage(
                chatId,
                "В целях безопасности бот доступен только в личных сообщениях"
            );
        }

        const startParam = match[1] ? match[1].trim() : null;

        if (isUserRegistered) {
            await bot.sendMessage(chatId, "Приветствие!", {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: "Открыть веб-апп!",
                                web_app: {
                                    url: process.env.WEB_APP_LINK,
                                },
                            },
                        ],
                    ],
                },
            });
        } else {
            await bot.sendMessage(chatId, "Приветствие!", {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: "Еще нет аккаунта?",
                                callback_data: "register",
                            },
                        ],
                        [
                            {
                                text: "Уже есть аккаунт",
                                callback_data: "login",
                            },
                        ],
                    ],
                },
            });
        }
    } catch (error) {
        console.log(error);
    }
});

bot.on("message", async (msg) => {
    await messageHandler(msg, bot);
});

bot.on("callback_query", async (callbackQuery: CallbackQuery) => {
    try {
        const action = callbackQuery.data || "";
        const handler = callbackHandlers[action];

        if (handler) {
            await handler(callbackQuery, bot);
        } else {
            const chatId = callbackQuery.message?.chat.id;
            if (chatId) {
                await bot.sendMessage(chatId, "Неизвестное действие.");
            }
        }

        await bot.answerCallbackQuery(callbackQuery.id);
    } catch (error) {
        console.error("Ошибка в обработчике callback_query:", error);
    }
});
