import TelegramBot from "node-telegram-bot-api";

export class Keyboard {
    static getMainKeyboard(): TelegramBot.ReplyKeyboardMarkup {
        return {
            keyboard: [
                [
                    { text: "📌 Добавить ссылки" },
                    { text: "🔍 Запустить проверку" },
                ],
                [
                    { text: "📋 Редактировать ссылки" },
                    { text: "❌ Удалить ссылки" },
                ],
                [
                    { text: "🔌 Добавить прокси" },
                    { text: "🔄 Статус проверки" },
                ],
                [
                    { text: "⚙️ Редактировать прокси" },
                    { text: "🗑️ Удалить прокси" },
                ],
                [{ text: "⏰ Тайминг проверок" }],
            ],
            resize_keyboard: true,
        };
    }

    static getCancelKeyboard(): TelegramBot.ReplyKeyboardMarkup {
        return {
            keyboard: [[{ text: "🔙 Отмена" }]],
            resize_keyboard: true,
        };
    }

    static getLinksKeyboard(
        links: Array<{ id: string; packageName: string }>
    ): TelegramBot.InlineKeyboardMarkup {
        const keyboard = links.map((link) => [
            { text: link.packageName, callback_data: `link_${link.id}` },
        ]);

        return {
            inline_keyboard: keyboard,
        };
    }

    static getProxiesKeyboard(
        proxies: Array<{ id: string; ipAddress: string; port: string }>
    ): TelegramBot.InlineKeyboardMarkup {
        const keyboard = proxies.map((proxy) => [
            {
                text: `${proxy.ipAddress}:${proxy.port}`,
                callback_data: `proxy_${proxy.id}`,
            },
        ]);

        return {
            inline_keyboard: keyboard,
        };
    }

    static getSchedulesKeyboard(
        schedules: Array<{ id: string; time: string }>
    ): TelegramBot.InlineKeyboardMarkup {
        const keyboard = schedules.map((schedule) => [
            { text: schedule.time, callback_data: `schedule_${schedule.id}` },
        ]);

        return {
            inline_keyboard: keyboard,
        };
    }

    static getYesNoKeyboard(
        prefix: string,
        id: string
    ): TelegramBot.InlineKeyboardMarkup {
        return {
            inline_keyboard: [
                [
                    { text: "✅ Да", callback_data: `${prefix}_yes_${id}` },
                    { text: "❌ Нет", callback_data: `${prefix}_no_${id}` },
                ],
            ],
        };
    }

    static getDeleteAllKeyboard(
        type: "links" | "proxies" | "schedules"
    ): TelegramBot.InlineKeyboardMarkup {
        return {
            inline_keyboard: [
                [
                    {
                        text: "🗑️ Удалить все",
                        callback_data: `delete_all_${type}`,
                    },
                    { text: "🔙 Отмена", callback_data: "cancel" },
                ],
            ],
        };
    }
}
