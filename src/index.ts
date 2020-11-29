require('dotenv').config();

import { Item } from './types';
import { setFullyInited } from './globals';
import { startWebUI } from './webui';
import { loadMatchers } from './matchers';
import { tryCheckItem } from './check';
import { YouTubeChat } from './livechat/youtube';
import { delay } from './util';

startWebUI();

const minSleep = parseInt(process.env.PAGE_SLEEP_MIN!, 10);
const maxSleep = parseInt(process.env.PAGE_SLEEP_MAX!, 10);
const minSleepTest = parseInt(process.env.TEST_SLEEP_MIN!, 10);
const maxSleepTest = parseInt(process.env.TEST_SLEEP_MAX!, 10);
function getSleepTime(min: number, max: number) {
    return min + (Math.random() * (max - min));
}

async function testLoop(item: Item) {
    const sleepTime = getSleepTime(minSleepTest, maxSleepTest);
    if (await tryCheckItem(item, false)) {
        console.log(`[${item.name}] TEST OK!`);
    }
    setTimeout(testLoop, sleepTime, item);
}

async function itemLoop(item: Item) {
    const sleepTime = getSleepTime(minSleep, maxSleep);
    await tryCheckItem(item, true);
    setTimeout(itemLoop, sleepTime, item);
}

async function main() {
    const tests = loadMatchers('testmatchers.json');
    const matchers = loadMatchers('matchers.json');

    tests.forEach(t => { t.testmode = true });
    matchers.forEach(m => { m.testmode = false });

    await Promise.all(tests.map(t => testLoop(t)));
    await Promise.all(matchers.map(m => itemLoop(m)));
}

async function chatMain() {
    const yt = new YouTubeChat({
        channelId: 'UCs9EGYVhFw--tRN0VESceMA',
        searchString: '5950X',
        name: 'YouTube Falcodrin',
    });
    await yt.findChat();
}

chatMain().catch((e) => console.error('chatMain', e));


main()
    .then(() => {
        console.log('INIT DONE');
        setFullyInited();
    })
    .catch((e) => {
        console.error(e.stack || e);
        process.exit(1);
    });
