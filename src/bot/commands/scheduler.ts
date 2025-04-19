import TelegramBot from "node-telegram-bot-api";
import { repository } from "../../db/repository";
import { Keyboard } from "../keyboard";
import { CONFIG } from "../../config";
import { isValidTimeFormat } from "../../utils/parser";

export class SchedulerCommands {
    private bot: TelegramBot;
    private userStates: Record<string, { action: string; data?: any }> = {};

    constructor(bot: TelegramBot) {
        this.bot = bot;
    }

    registerHandlers() {
        // Handle button clicks
        this.bot.onText(
            /⏰ Тайминг проверок/,
            this.handleSchedulerMenu.bind(this)
        );

        // Handle message input for adding schedules
        this.bot.on("message", this.handleUserInput.bind(this));

        // Handle callback queries for editing/deleting schedules
        this.bot.on("callback_query", this.handleCallbackQuery.bind(this));
    }

    private async handleSchedulerMenu(msg: TelegramBot.Message) {
        const chatId = msg.chat.id.toString();

        await this.bot.sendMessage(
            chatId,
            "⏰ Управление расписанием проверок:",
            {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: "➕ Добавить время проверки",
                                callback_data: "add_schedule",
                            },
                        ],
                        [
                            {
                                text: "📝 Список текущих проверок",
                                callback_data: "list_schedules",
                            },
                        ],
                        [
                            {
                                text: "🗑️ Удалить расписание",
                                callback_data: "delete_schedule",
                            },
                        ],
                    ],
                },
            }
        );
    }

    private async handleUserInput(msg: TelegramBot.Message) {
        if (!(await repository.isUserPermitted(msg.from.username))) {
            return;
        }
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

        // Handle adding schedule
        if (userState.action === "add_schedule") {
            const time = msg.text.trim();

            if (!isValidTimeFormat(time)) {
                await this.bot.sendMessage(
                    chatId,
                    "⚠️ Некорректный формат времени. Пожалуйста, используйте формат ЧЧ:ММ (например, 09:30)."
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

            // Get current schedules count
            const userSchedules = await repository.getUserCheckSchedules(
                user.id
            );

            if (userSchedules.length >= CONFIG.app.maxSchedulesPerUser) {
                await this.bot.sendMessage(
                    chatId,
                    `⚠️ Вы достигли максимального количества расписаний (${CONFIG.app.maxSchedulesPerUser}). Удалите некоторые расписания перед добавлением новых.`
                );
                return;
            }

            // Check if this time already exists
            const existingSchedule = userSchedules.find(
                (schedule) => schedule.time === time
            );

            if (existingSchedule) {
                await this.bot.sendMessage(
                    chatId,
                    "⚠️ Расписание с таким временем уже существует."
                );
                return;
            }

            // Add schedule
            try {
                await repository.addCheckSchedule(user.id, time);
                delete this.userStates[chatId];

                await this.bot.sendMessage(
                    chatId,
                    `✅ Расписание на ${time} успешно добавлено.`,
                    { reply_markup: Keyboard.getMainKeyboard() }
                );
            } catch (error) {
                await this.bot.sendMessage(
                    chatId,
                    `❌ Ошибка при добавлении расписания: ${error.message}`
                );
            }
        }

        // Handle editing schedule
        else if (userState.action === "edit_schedule" && userState.data) {
            const time = msg.text.trim();

            if (!isValidTimeFormat(time)) {
                await this.bot.sendMessage(
                    chatId,
                    "⚠️ Некорректный формат времени. Пожалуйста, используйте формат ЧЧ:ММ (например, 09:30)."
                );
                return;
            }

            try {
                const user = await repository.getOrCreateUser(chatId);

                // Check if this time already exists
                const userSchedules = await repository.getUserCheckSchedules(
                    user.id
                );
                const existingSchedule = userSchedules.find(
                    (schedule) =>
                        schedule.time === time &&
                        schedule.id !== userState.data.scheduleId
                );

                if (existingSchedule) {
                    await this.bot.sendMessage(
                        chatId,
                        "⚠️ Расписание с таким временем уже существует."
                    );
                    return;
                }

                await repository.updateCheckSchedule(
                    userState.data.scheduleId,
                    user.id,
                    {
                        time,
                    }
                );

                delete this.userStates[chatId];

                await this.bot.sendMessage(
                    chatId,
                    `✅ Расписание успешно обновлено на ${time}.`,
                    { reply_markup: Keyboard.getMainKeyboard() }
                );
            } catch (error) {
                await this.bot.sendMessage(
                    chatId,
                    `❌ Ошибка при обновлении расписания: ${error.message}`
                );
            }
        }
    }

    private async handleCallbackQuery(query: TelegramBot.CallbackQuery) {
        if (!query.message || !query.data) return;

        const chatId = query.message.chat.id.toString();

        // Handle add schedule
        if (query.data === "add_schedule") {
            this.userStates[chatId] = { action: "add_schedule" };

            await this.bot.sendMessage(
                chatId,
                "Введите время для проверки в формате ЧЧ:ММ (например, 09:30):",
                { reply_markup: Keyboard.getCancelKeyboard() }
            );
        }

        // Handle list schedules
        else if (query.data === "list_schedules") {
            try {
                const user = await repository.getOrCreateUser(chatId);
                const schedules = await repository.getUserCheckSchedules(
                    user.id
                );

                if (schedules.length === 0) {
                    await this.bot.sendMessage(
                        chatId,
                        "⚠️ У вас нет добавленных расписаний проверок.",
                        { reply_markup: Keyboard.getMainKeyboard() }
                    );
                    return;
                }

                const scheduleList = schedules
                    .map(
                        (schedule) =>
                            `${schedule.isActive ? "✅" : "❌"} ${
                                schedule.time
                            }`
                    )
                    .join("\n");

                await this.bot.sendMessage(
                    chatId,
                    `📋 Ваши расписания проверок:\n\n${scheduleList}`,
                    {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    {
                                        text: "✏️ Редактировать",
                                        callback_data: "edit_schedule_list",
                                    },
                                ],
                                [
                                    {
                                        text: "🔙 Вернуться",
                                        callback_data: "back_to_main",
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

        // Handle edit schedule list
        else if (query.data === "edit_schedule_list") {
            try {
                const user = await repository.getOrCreateUser(chatId);
                const schedules = await repository.getUserCheckSchedules(
                    user.id
                );

                if (schedules.length === 0) {
                    await this.bot.sendMessage(
                        chatId,
                        "⚠️ У вас нет добавленных расписаний проверок.",
                        { reply_markup: Keyboard.getMainKeyboard() }
                    );
                    return;
                }

                await this.bot.sendMessage(
                    chatId,
                    "Выберите расписание для редактирования:",
                    { reply_markup: Keyboard.getSchedulesKeyboard(schedules) }
                );
            } catch (error) {
                await this.bot.sendMessage(
                    chatId,
                    `❌ Ошибка: ${error.message}`
                );
            }
        }

        // Handle delete schedule
        else if (query.data === "delete_schedule") {
            try {
                const user = await repository.getOrCreateUser(chatId);
                const schedules = await repository.getUserCheckSchedules(
                    user.id
                );

                if (schedules.length === 0) {
                    await this.bot.sendMessage(
                        chatId,
                        "⚠️ У вас нет добавленных расписаний проверок.",
                        { reply_markup: Keyboard.getMainKeyboard() }
                    );
                    return;
                }

                await this.bot.sendMessage(
                    chatId,
                    "Выберите расписание для удаления или удалите все:",
                    {
                        reply_markup: {
                            inline_keyboard: [
                                ...Keyboard.getSchedulesKeyboard(schedules)
                                    .inline_keyboard,
                                [
                                    {
                                        text: "🗑️ Удалить все",
                                        callback_data: "delete_all_schedules",
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

        // Handle schedule selection
        else if (query.data.startsWith("schedule_")) {
            const scheduleId = query.data.replace("schedule_", "");

            try {
                const user = await repository.getOrCreateUser(chatId);
                const schedules = await repository.getUserCheckSchedules(
                    user.id
                );
                const selectedSchedule = schedules.find(
                    (s) => s.id === scheduleId
                );

                if (!selectedSchedule) {
                    await this.bot.sendMessage(
                        chatId,
                        "❌ Расписание не найдено."
                    );
                    return;
                }

                await this.bot.sendMessage(
                    chatId,
                    `Выбрано расписание: ${selectedSchedule.time}\n` +
                        `Статус: ${
                            selectedSchedule.isActive ? "Активно" : "Неактивно"
                        }\n\n` +
                        `Что вы хотите сделать?`,
                    {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    {
                                        text: "✏️ Изменить время",
                                        callback_data: `edit_schedule_time_${scheduleId}`,
                                    },
                                    {
                                        text: selectedSchedule.isActive
                                            ? "⏸ Деактивировать"
                                            : "▶️ Активировать",
                                        callback_data: `toggle_schedule_${scheduleId}`,
                                    },
                                ],
                                [
                                    {
                                        text: "🗑️ Удалить",
                                        callback_data: `confirm_delete_schedule_${scheduleId}`,
                                    },
                                    {
                                        text: "🔙 Назад",
                                        callback_data: "back_to_schedules",
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

        // Handle edit schedule time
        else if (query.data.startsWith("edit_schedule_time_")) {
            const scheduleId = query.data.replace("edit_schedule_time_", "");

            this.userStates[chatId] = {
                action: "edit_schedule",
                data: { scheduleId },
            };

            await this.bot.sendMessage(
                chatId,
                "Введите новое время для проверки в формате ЧЧ:ММ (например, 09:30):",
                { reply_markup: Keyboard.getCancelKeyboard() }
            );
        }

        // Handle toggle schedule
        else if (query.data.startsWith("toggle_schedule_")) {
            const scheduleId = query.data.replace("toggle_schedule_", "");

            try {
                const user = await repository.getOrCreateUser(chatId);
                const schedules = await repository.getUserCheckSchedules(
                    user.id
                );
                const selectedSchedule = schedules.find(
                    (s) => s.id === scheduleId
                );

                if (!selectedSchedule) {
                    await this.bot.sendMessage(
                        chatId,
                        "❌ Расписание не найдено."
                    );
                    return;
                }

                await repository.updateCheckSchedule(scheduleId, user.id, {
                    isActive: !selectedSchedule.isActive,
                });

                await this.bot.sendMessage(
                    chatId,
                    `✅ Расписание ${selectedSchedule.time} ${
                        selectedSchedule.isActive
                            ? "деактивировано"
                            : "активировано"
                    }.`,
                    { reply_markup: Keyboard.getMainKeyboard() }
                );
            } catch (error) {
                await this.bot.sendMessage(
                    chatId,
                    `❌ Ошибка: ${error.message}`
                );
            }
        }

        // Handle confirm delete schedule
        else if (query.data.startsWith("confirm_delete_schedule_")) {
            const scheduleId = query.data.replace(
                "confirm_delete_schedule_",
                ""
            );

            await this.bot.sendMessage(
                chatId,
                "Вы уверены, что хотите удалить это расписание?",
                {
                    reply_markup: Keyboard.getYesNoKeyboard(
                        "delete_schedule",
                        scheduleId
                    ),
                }
            );
        }

        // Handle delete schedule confirmation
        else if (query.data.startsWith("delete_schedule_yes_")) {
            const scheduleId = query.data.replace("delete_schedule_yes_", "");

            try {
                const user = await repository.getOrCreateUser(chatId);
                await repository.deleteCheckSchedule(scheduleId, user.id);

                await this.bot.sendMessage(
                    chatId,
                    "✅ Расписание успешно удалено.",
                    { reply_markup: Keyboard.getMainKeyboard() }
                );
            } catch (error) {
                await this.bot.sendMessage(
                    chatId,
                    `❌ Ошибка при удалении расписания: ${error.message}`
                );
            }
        }

        // Handle delete schedule cancellation
        else if (query.data.startsWith("delete_schedule_no_")) {
            await this.bot.sendMessage(chatId, "✅ Удаление отменено.", {
                reply_markup: Keyboard.getMainKeyboard(),
            });
        }

        // Handle delete all schedules
        else if (query.data === "delete_all_schedules") {
            await this.bot.sendMessage(
                chatId,
                "⚠️ Вы уверены, что хотите удалить ВСЕ расписания? Это действие нельзя отменить.",
                {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: "✅ Да, удалить все",
                                    callback_data:
                                        "confirm_delete_all_schedules",
                                },
                                { text: "❌ Отмена", callback_data: "cancel" },
                            ],
                        ],
                    },
                }
            );
        }

        // Handle confirm delete all schedules
        else if (query.data === "confirm_delete_all_schedules") {
            try {
                const user = await repository.getOrCreateUser(chatId);
                const schedules = await repository.getUserCheckSchedules(
                    user.id
                );

                for (const schedule of schedules) {
                    await repository.deleteCheckSchedule(schedule.id, user.id);
                }

                await this.bot.sendMessage(
                    chatId,
                    `✅ Все расписания удалены (${schedules.length}).`,
                    { reply_markup: Keyboard.getMainKeyboard() }
                );
            } catch (error) {
                await this.bot.sendMessage(
                    chatId,
                    `❌ Ошибка при удалении расписаний: ${error.message}`
                );
            }
        }

        // Handle back to main menu
        else if (query.data === "back_to_main") {
            await this.bot.sendMessage(chatId, "Выберите действие:", {
                reply_markup: Keyboard.getMainKeyboard(),
            });
        }

        // Handle back to schedules list
        else if (query.data.startsWith("schedules_page_")) {
            const schedulePage = query.data.replace("schedules_page_", "");
            try {
                const user = await repository.getOrCreateUser(chatId);
                const schedules = await repository.getUserCheckSchedules(
                    user.id
                );

                if (schedules.length === 0) {
                    await this.bot.sendMessage(
                        chatId,
                        "⚠️ У вас нет добавленных расписаний проверок.",
                        { reply_markup: Keyboard.getMainKeyboard() }
                    );
                    return;
                }

                await this.bot.sendMessage(
                    chatId,
                    "Выберите расписание для редактирования:",
                    {
                        reply_markup: Keyboard.getSchedulesKeyboard(
                            schedules,
                            +schedulePage
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

        // Handle pagination
        else if (query.data === "back_to_schedules") {
            try {
                const user = await repository.getOrCreateUser(chatId);
                const schedules = await repository.getUserCheckSchedules(
                    user.id
                );

                if (schedules.length === 0) {
                    await this.bot.sendMessage(
                        chatId,
                        "⚠️ У вас нет добавленных расписаний проверок.",
                        { reply_markup: Keyboard.getMainKeyboard() }
                    );
                    return;
                }

                await this.bot.sendMessage(
                    chatId,
                    "Выберите расписание для редактирования:",
                    { reply_markup: Keyboard.getSchedulesKeyboard(schedules) }
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
