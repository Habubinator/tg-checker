import dotenv from "dotenv";

dotenv.config();

export const CONFIG = {
    bot: {
        token: process.env.BOT_TOKEN || "",
    },
    app: {
        maxLinksPerUser: parseInt(process.env.MAX_LINKS_PER_USER || "100"),
        maxProxiesPerUser: parseInt(process.env.MAX_PROXIES_PER_USER || "50"),
        maxSchedulesPerUser: parseInt(
            process.env.MAX_SCHEDULES_PER_USER || "5"
        ),
        requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || "30000"),
        delayBetweenRequests: parseInt(
            process.env.DELAY_BETWEEN_REQUESTS || "2000"
        ),
    },
};
