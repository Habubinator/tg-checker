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
        links: Array<{ id: string; packageName: string }>,
        page: number = 0,
        pageSize: number = 50
    ): TelegramBot.InlineKeyboardMarkup {
        const totalPages = Math.ceil(links.length / pageSize);
        const start = page * pageSize;
        const end = start + pageSize;
        const currentLinks = links.slice(start, end);

        const keyboard = currentLinks.map((link) => [
            { text: link.packageName, callback_data: `link_${link.id}` },
        ]);

        const navigationButtons = [];
        if (page > 0) {
            navigationButtons.push({
                text: "⬅️ Назад",
                callback_data: `page_link_${page - 1}`,
            });
        }
        if (page < totalPages - 1) {
            navigationButtons.push({
                text: "➡️ Далее",
                callback_data: `page_link_${page + 1}`,
            });
        }

        if (navigationButtons.length > 0) {
            keyboard.push(navigationButtons);
        }

        return {
            inline_keyboard: keyboard,
        };
    }

    static getProxiesKeyboard(
        proxies: Array<{ id: string; ipAddress: string; port: string }>,
        page: number = 0,
        pageSize: number = 50
    ): TelegramBot.InlineKeyboardMarkup {
        const totalPages = Math.ceil(proxies.length / pageSize);
        const start = page * pageSize;
        const end = start + pageSize;
        const currentProxies = proxies.slice(start, end);

        const keyboard = currentProxies.map((proxy) => [
            {
                text: `${proxy.ipAddress}:${proxy.port}`,
                callback_data: `proxy_${proxy.id}`,
            },
        ]);

        const navigationButtons = [];
        if (page > 0) {
            navigationButtons.push({
                text: "⬅️ Назад",
                callback_data: `proxies_page_${page - 1}`,
            });
        }
        if (page < totalPages - 1) {
            navigationButtons.push({
                text: "➡️ Далее",
                callback_data: `proxies_page_${page + 1}`,
            });
        }

        if (navigationButtons.length > 0) {
            keyboard.push(navigationButtons);
        }

        return {
            inline_keyboard: keyboard,
        };
    }

    static getSchedulesKeyboard(
        schedules: Array<{ id: string; time: string }>,
        page: number = 0,
        pageSize: number = 50
    ): TelegramBot.InlineKeyboardMarkup {
        const totalPages = Math.ceil(schedules.length / pageSize);
        const start = page * pageSize;
        const end = start + pageSize;
        const currentSchedules = schedules.slice(start, end);

        const keyboard = currentSchedules.map((schedule) => [
            { text: schedule.time, callback_data: `schedule_${schedule.id}` },
        ]);

        const navigationButtons = [];
        if (page > 0) {
            navigationButtons.push({
                text: "⬅️ Назад",
                callback_data: `schedules_page_${page - 1}`,
            });
        }
        if (page < totalPages - 1) {
            navigationButtons.push({
                text: "➡️ Далее",
                callback_data: `schedules_page_${page + 1}`,
            });
        }

        if (navigationButtons.length > 0) {
            keyboard.push(navigationButtons);
        }

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
