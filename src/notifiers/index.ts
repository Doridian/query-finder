import { Item } from '../types.js';
import TG from 'node-telegram-bot-api';
import { config } from '../config.js';

const tgChatId = config.TELEGRAM_CHAT_ID;
const tgApi = config.TELEGRAM_ACCESS_TOKEN ? new TG(config.TELEGRAM_ACCESS_TOKEN, { polling: !tgChatId }) : undefined;

if (tgApi && !tgChatId) {
    tgApi.onText(/SHOW_ID_QUERY_FINDER/, (msg) => {
        const chatId = msg.chat.id;
        tgApi.sendMessage(chatId, `This chat ID is: ${chatId}`);
    });
}

export async function notifyItem(item: Item) {
    const notifyText = `FOUND: ${item.name} at ${item.browserUrl || item.url}`;
    await notify(notifyText);
}

export async function notify(notifyText: string, options: Partial<TG.SendMessageOptions> = {}) {
    if (!tgApi || !tgChatId) {
        return;
    }
    await tgApi.sendMessage(
        tgChatId,
        notifyText,
        {
            disable_web_page_preview: true,
            ...options,
        },
    );
}
