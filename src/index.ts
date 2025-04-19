import TelegramBot from "node-telegram-bot-api";
import { CONFIG } from "./config";
import { BotHandlers } from "./bot/handlers";
import { Scheduler } from "./services/scheduler";
/**
 * Main application entry point
 * Initializes the Telegram bot and sets up handlers
 */
async function main(): Promise<void> {
    console.log("Starting Google Play Checker Bot...");

    // Validate bot token
    if (!CONFIG.bot.token) {
        console.error(
            "Error: Bot token is missing! Please check your .env file."
        );
        process.exit(1);
    }

    try {
        // Initialize the bot with token from config
        const bot = new TelegramBot(CONFIG.bot.token, { polling: true });
        console.log("Bot initialized successfully!");

        // Set up the handlers
        const handlers = new BotHandlers(bot);
        handlers.registerHandlers();
        console.log("Bot handlers registered successfully!");

        const scheduler = new Scheduler(bot);
        scheduler.init();

        // Log successful startup
        console.log("Bot is now running. Press CTRL+C to stop.");

        // Handle application termination
        process.on("SIGINT", async () => {
            console.log("Received SIGINT. Shutting down bot...");
            await bot.close();
            process.exit(0);
        });

        process.on("SIGTERM", async () => {
            console.log("Received SIGTERM. Shutting down bot...");
            await bot.close();
            process.exit(0);
        });

        // Unhandled errors
        bot.on("polling_error", (error) => {
            console.error("Polling error:", error);
        });
    } catch (error) {
        console.error("Error starting the bot:", error);
        process.exit(1);
    }
}

// Run the application
main().catch((error) => {
    console.error("Unhandled error in main:", error);
    process.exit(1);
});
