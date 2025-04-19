import TelegramBot, { CallbackQuery, Message } from "node-telegram-bot-api";
import { prisma } from "@database";

const userStates: Record<
    number,
    {
        step: string;
        login?: string;
        previousStep?: string;
        lastBotMessageId?: number;
        lastUserMessageId?: number;
        chatId?: number;
    }
> = {};

export const callbackHandlers = {
    register: async (callbackQuery: CallbackQuery, bot: TelegramBot) => {
        const userId = callbackQuery.from.id;
        const chatId = callbackQuery.message?.chat.id;

        if (!chatId) return;

        const userState = userStates[userId] || {};
        userStates[userId] = {
            ...userState,
            step: "register",
            previousStep: "start",
            chatId,
        };

        await bot.deleteMessage(chatId, callbackQuery.message.message_id);

        const sentMessage = await bot.sendMessage(chatId, "Приветствие!", {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: "Открыть веб-апп!",
                            web_app: {
                                url: process.env.WEB_APP_LINK || "",
                            },
                        },
                    ],
                    [{ text: "❌ Назад", callback_data: "back" }],
                ],
            },
        });

        userStates[userId].lastBotMessageId = sentMessage.message_id;
    },

    login: async (callbackQuery: CallbackQuery, bot: TelegramBot) => {
        const userId = callbackQuery.from.id;
        const chatId = callbackQuery.message?.chat.id;

        if (!chatId) return;

        await bot.deleteMessage(chatId, callbackQuery.message?.message_id);

        userStates[userId] = {
            step: "awaitingLogin",
            previousStep: "start",
            chatId,
        };

        const sentMessage = await bot.sendMessage(chatId, "Введите логин:", {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "❌ Назад", callback_data: "back" }],
                ],
            },
        });

        userStates[userId].lastBotMessageId = sentMessage.message_id;
    },

    back: async (callbackQuery: CallbackQuery, bot: TelegramBot) => {
        const userId = callbackQuery.from.id;
        const userState = userStates[userId];
        if (!userState) return;

        const chatId = userState.chatId;
        if (!chatId) return;

        await deletePreviousMessages(userId, bot);

        const previousStep = userState.previousStep;

        if (previousStep === "start") {
            delete userStates[userId];

            const sentMessage = await bot.sendMessage(chatId, "Приветствие!", {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: "Еще нет аккаунта?",
                                callback_data: "register",
                            },
                        ],
                        [{ text: "Уже есть аккаунт", callback_data: "login" }],
                    ],
                },
            });

            userStates[userId] = {
                step: "start",
                chatId,
                lastBotMessageId: sentMessage.message_id,
            };
        } else if (previousStep === "awaitingLogin") {
            userStates[userId] = {
                step: "awaitingLogin",
                previousStep: "start",
                chatId,
            };

            const sentMessage = await bot.sendMessage(
                chatId,
                "Введите логин:",
                {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "❌ Назад", callback_data: "back" }],
                        ],
                    },
                }
            );

            userStates[userId].lastBotMessageId = sentMessage.message_id;
        }
    },
};

const deletePreviousMessages = async (userId: number, bot: TelegramBot) => {
    const userState = userStates[userId];
    if (!userState) return;

    const chatId = userState.chatId;
    if (!chatId) return;

    if (userState.lastBotMessageId) {
        try {
            await bot.deleteMessage(chatId, userState.lastBotMessageId);
        } catch (err) {
            console.error(`Failed to delete bot message: ${err}`);
        }
    }

    if (userState.lastUserMessageId) {
        try {
            await bot.deleteMessage(chatId, userState.lastUserMessageId);
        } catch (err) {
            console.error(`Failed to delete user message: ${err}`);
        }
    }
};

export const messageHandler = async (msg: Message, bot: TelegramBot) => {
    const chatId = msg.chat.id;
    const userState = userStates[chatId] || { step: null };
    userStates[chatId] = { ...userState, lastUserMessageId: msg.message_id };

    await deletePreviousMessages(chatId, bot);

    if (userState.step === "awaitingLogin") {
        userStates[chatId].login = msg.text || "";
        userStates[chatId].previousStep = "awaitingLogin";
        userStates[chatId].step = "awaitingPassword";

        const sentMessage = await bot.sendMessage(chatId, "Введите пароль:", {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "❌ Назад", callback_data: "back" }],
                ],
            },
        });

        userStates[chatId].lastBotMessageId = sentMessage.message_id;
    } else if (userState.step === "awaitingPassword") {
    }
};
