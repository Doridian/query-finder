require('dotenv').config();

import { Item } from './types';
import { ITEMS_MAP, LAST_STATUS_MAP, setFullyInited } from './globals';
import { startWebUI } from './webui';
import { loadMatchers } from './matchers';
import { tryCheckItem } from './check';

startWebUI();

const minSleep = parseInt(process.env.PAGE_SLEEP_MIN!, 10);
const maxSleep = parseInt(process.env.PAGE_SLEEP_MAX!, 10);
const minSleepTest = parseInt(process.env.TEST_SLEEP_MIN!, 10);
const maxSleepTest = parseInt(process.env.TEST_SLEEP_MAX!, 10);
function getSleepTime(min: number, max: number) {
    return min + (Math.random() * (max - min));
}

async function testLoop(item: Item) {
    const sleepTime = getSleepTime(minSleepTest, maxSleepTest) * (item.sleepMultiplier || 1);
    if (await tryCheckItem(item, false)) {
        console.log(`[${item.name}] TEST OK!`);
    }
    setTimeout(testLoop, sleepTime, item);
}

async function itemLoop(item: Item) {
    const sleepTime = getSleepTime(minSleep, maxSleep) * (item.sleepMultiplier || 1);
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

main()
    .then(() => {
        console.log('INIT DONE');
        for (const k of Object.keys(LAST_STATUS_MAP)) {
            if (ITEMS_MAP[k]) {
                continue;
            }
            delete LAST_STATUS_MAP[k];
        }
        setFullyInited();
    })
    .catch((e) => {
        console.error(e.stack || e);
        process.exit(1);
    });
