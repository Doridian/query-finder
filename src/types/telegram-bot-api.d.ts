declare module 'telegram-bot-api' {
    class TelegramBot {
        constructor({
            token: string,
        });

        sendMessage({
            chat_id: string,
            disable_web_page_preview: string,
            text: string
        }): Promise<void>;
    }
    export default TelegramBot;
}
