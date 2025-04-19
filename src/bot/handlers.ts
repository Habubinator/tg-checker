import TelegramBot from "node-telegram-bot-api";
import { AppLinksCommands } from "./commands/appLinks";
import { ProxyCommands } from "./commands/proxy";
import { SchedulerCommands } from "./commands/scheduler";
import { CheckCommands } from "./commands/check";
import { Keyboard } from "./keyboard";
import { repository } from "../db/repository";

export class BotHandlers {
    private bot: TelegramBot;
    private appLinksCommands: AppLinksCommands;
    private proxyCommands: ProxyCommands;
    private schedulerCommands: SchedulerCommands;
    private checkCommands: CheckCommands;

    constructor(bot: TelegramBot) {
        this.bot = bot;
        this.bot.setMyCommands([
            {
                command: "/start",
                description: "Начать работу с ботом",
            },
            {
                command: "/help",
                description: "Получить справку по командам",
            },
            {
                command: "/add",
                description: "Добавить юзера",
            },
            {
                command: "/delete",
                description: "Удалить юзера",
            },
        ]);
        this.appLinksCommands = new AppLinksCommands(bot);
        this.proxyCommands = new ProxyCommands(bot);
        this.schedulerCommands = new SchedulerCommands(bot);
        this.checkCommands = new CheckCommands(bot);
    }

    /**
     * Register all command handlers for the bot
     */
    public registerHandlers(): void {
        // Register command-specific handlers
        this.appLinksCommands.registerHandlers();
        this.proxyCommands.registerHandlers();
        this.schedulerCommands.registerHandlers();
        this.checkCommands.registerHandlers();

        // Register global commands
        this.registerGlobalCommands();
    }

    /**
     * Register global commands for the bot
     */
    private registerGlobalCommands(): void {
        // Start command
        this.bot.onText(/\/start/, this.handleStart.bind(this));

        // Help command
        this.bot.onText(/\/help/, this.handleHelp.bind(this));

        // Add command
        this.bot.onText(/\/add (.+)/, this.handleAdd.bind(this));
        this.bot.onText(/\/add$/, this.handleAdd.bind(this));

        // Delete command
        this.bot.onText(/\/delete (.+)/, this.handleDelete.bind(this));
        this.bot.onText(/\/delete$/, this.handleDelete.bind(this));

        // Status check
        this.bot.onText(
            /🔄 Статус проверки/,
            this.handleStatusCheck.bind(this)
        );
    }

    /**
     * Handle the /start command
     * @param msg - Telegram message
     */
    private async handleStart(msg: TelegramBot.Message): Promise<void> {
        if (!(await repository.isUserPermitted(msg.from.username))) {
            return;
        }
        const chatId = msg.chat.id.toString();

        // Create or get user
        await repository.getOrCreateUser(
            chatId,
            msg.chat.username,
            msg.chat.first_name,
            msg.chat.last_name
        );

        const welcomeMessage =
            "👋 Добро пожаловать в Google Play Checker Bot!\n\n" +
            "Этот бот поможет вам проверять доступность приложений в Google Play.\n\n" +
            "🔹 Как использовать:\n" +
            "1. Добавьте ссылки на приложения\n" +
            "2. Добавьте прокси для проверки\n" +
            "3. Настройте расписание проверок или запустите проверку вручную\n\n" +
            "Используйте кнопки меню для навигации. Нажмите /help для дополнительной информации.";

        await this.bot.sendMessage(chatId, welcomeMessage, {
            reply_markup: Keyboard.getMainKeyboard(),
            parse_mode: "Markdown",
        });
    }

    /**
     * Handle the /help command
     * @param msg - Telegram message
     */
    private async handleHelp(msg: TelegramBot.Message): Promise<void> {
        if (!(await repository.isUserPermitted(msg.from.username))) {
            return;
        }
        const chatId = msg.chat.id.toString();

        const helpMessage =
            "📚 *Справка по использованию бота*\n\n" +
            "*Основные команды:*\n" +
            "📌 *Добавить ссылки* - добавляйте ссылки на приложения Google Play\n" +
            "📋 *Редактировать ссылки* - просмотр и изменение добавленных ссылок\n" +
            "❌ *Удалить ссылки* - удаление одной или всех ссылок\n\n" +
            "🔌 *Добавить прокси* - добавление прокси в формате ip:port или ip:port:user:pass\n" +
            "⚙️ *Редактировать прокси* - изменение настроек прокси\n" +
            "🗑️ *Удалить прокси* - удаление одного или всех прокси\n\n" +
            "⏰ *Тайминг проверок* - настройка расписания автоматических проверок\n" +
            "🔍 *Запустить проверку* - запуск проверки доступности приложений\n" +
            "🔄 *Статус проверки* - просмотр результатов последней проверки\n\n" +
            "*/start* - перезапуск бота\n" +
            "*/help* - показать это сообщение";

        await this.bot.sendMessage(chatId, helpMessage, {
            parse_mode: "Markdown",
        });
    }

    /**
     * Handle the status check button
     * @param msg - Telegram message
     */
    private async handleStatusCheck(msg: TelegramBot.Message): Promise<void> {
        if (!(await repository.isUserPermitted(msg.from.username))) {
            return;
        }
        const chatId = msg.chat.id.toString();

        try {
            // Get user
            const user = await repository.getOrCreateUser(
                chatId,
                msg.chat.username,
                msg.chat.first_name,
                msg.chat.last_name
            );

            // Get latest check results
            const results = await repository.getLatestCheckResults(user.id);

            if (results.length === 0) {
                await this.bot.sendMessage(
                    chatId,
                    "⚠️ У вас еще не было проведено ни одной проверки."
                );
                return;
            }

            // Format results
            const latestCheckTime = results[0].checkTime;
            const formattedDate = latestCheckTime.toLocaleString("ru-RU");

            let statusMessage = `📊 *Результаты последней проверки от ${formattedDate}*\n\n`;

            const available = results.filter((r) => r.isAvailable).length;
            const unavailable = results.length - available;

            statusMessage += `✅ Доступно: ${available}\n`;
            statusMessage += `❌ Недоступно: ${unavailable}\n\n`;

            // List all results
            for (const result of results) {
                statusMessage += result.isAvailable
                    ? `✅ ${result.appLink.packageName} — Доступно\n`
                    : `❌ ${result.appLink.packageName} — ${
                          result.errorMessage || "Недоступно"
                      }\n`;
            }

            await this.bot.sendMessage(chatId, statusMessage, {
                parse_mode: "Markdown",
            });
        } catch (error) {
            console.error("Error in status check:", error);
            await this.bot.sendMessage(
                chatId,
                "❌ Произошла ошибка при получении статуса проверки."
            );
        }
    }

    private async handleAdd(
        msg: TelegramBot.Message,
        match: RegExpExecArray | null
    ): Promise<void> {
        if (!(await repository.isUserPermitted(msg.from.username))) {
            return;
        }
        const chatId = msg.chat.id.toString();

        if (!match || !match[1]) {
            await this.bot.sendMessage(
                chatId,
                "❌ Пожалуйста, укажите username. Пример: /add username"
            );
            return;
        }

        const usernameToAdd = match[1].trim();

        try {
            await repository.addApprovedUser(usernameToAdd);
            await this.bot.sendMessage(
                chatId,
                `✅ Пользователь @${usernameToAdd} успешно добавлен!`
            );
        } catch (error) {
            console.error("Ошибка при добавлении пользователя:", error);
            await this.bot.sendMessage(
                chatId,
                "❌ Произошла ошибка при добавлении пользователя."
            );
        }
    }

    private async handleDelete(
        msg: TelegramBot.Message,
        match: RegExpExecArray | null
    ): Promise<void> {
        if (!(await repository.isUserPermitted(msg.from.username))) {
            return;
        }
        const chatId = msg.chat.id.toString();

        if (!match || !match[1]) {
            await this.bot.sendMessage(
                chatId,
                "❌ Пожалуйста, укажите username для удаления. Пример: /delete username"
            );
            return;
        }

        const usernameToDelete = match[1].trim();

        try {
            await repository.removeApprovedUser(usernameToDelete);
            await this.bot.sendMessage(
                chatId,
                `✅ Пользователь @${usernameToDelete} успешно удалён!`
            );
        } catch (error) {
            console.error("Ошибка при удалении пользователя:", error);
            await this.bot.sendMessage(
                chatId,
                "❌ Произошла ошибка при удалении пользователя."
            );
        }
    }
}
