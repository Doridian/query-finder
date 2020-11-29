require('dotenv').config();

import { YouTubeChat } from "./livechat/youtube";

async function main() {
    const yt = new YouTubeChat({
        channelId: 'UCs9EGYVhFw--tRN0VESceMA',
        searchString: '5950X',
        name: 'YouTube Falcodrin',
    });
    await yt.findChat();
}

main().catch((e) => console.error(e));
