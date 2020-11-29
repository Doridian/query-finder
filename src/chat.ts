require('dotenv').config();

import { YouTubeChat } from "./livechat/youtube";

async function chatMain() {
    const yt = new YouTubeChat({
        channelId: 'UCs9EGYVhFw--tRN0VESceMA',
        searchString: '5950X',
        name: 'YouTube Falcodrin',
    });
    await yt.findChat();
}

chatMain().catch((e) => console.error('chatMain', e));
