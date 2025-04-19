import dotenv from "dotenv";
dotenv.config();
import TelegramBot, { CallbackQuery } from "node-telegram-bot-api";

const token = process.env.BOT_TOKEN;
process.env["NTBA_FIX_350"] = "1";
process.env["NTBA_FIX_319"] = "1";

export const bot = new TelegramBot(token, { polling: true });
