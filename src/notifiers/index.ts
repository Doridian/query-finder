import { MinimalItem } from '../types';
const TG = require('telegram-bot-api');

const tgChatId = process.env.TELEGRAM_CHAT_ID;
const tgApi = new TG({
    token: process.env.TELEGRAM_ACCESS_TOKEN,
});

export async function notify(item: MinimalItem) {
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
