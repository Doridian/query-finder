import { Item } from '../types.js';
import TG from 'telegram-bot-api';
import { config } from '../config.js';

const tgChatId = config.TELEGRAM_CHAT_ID;
const tgApi = new TG({
    token: config.TELEGRAM_ACCESS_TOKEN,
});

export async function notify(item: Item) {
    const notifyText = `FOUND: ${item.name} at ${item.browserUrl || item.url}`;
    await notifyRaw(notifyText);
}

export async function notifyRaw(notifyText: string) {
    await tgApi.sendMessage({
        chat_id: tgChatId,
        disable_web_page_preview: 'true',
        text: notifyText,
    });
}
