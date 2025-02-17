import { ITEMS_MAP, LAST_STATUS_MAP, setFullyInited } from './globals.js';
import { initStores, loadAllItems, loadTestItems } from './stores/index.js';

import { Item } from './types.js';
import { config } from './config.js';
import { delay } from './util.js';
import { refreshProxyLoop } from './proxy.js';
import { startWebUI } from './webui.js';
import { tryCheckItem } from './check.js';
import { notify } from './notifiers/index.js';

startWebUI();

const minSleep = parseInt(config.PAGE_SLEEP_MIN!, 10);
const maxSleep = parseInt(config.PAGE_SLEEP_MAX!, 10);
const minSleepTest = parseInt(config.TEST_SLEEP_MIN!, 10);
const maxSleepTest = parseInt(config.TEST_SLEEP_MAX!, 10);
function getSleepTime(min: number, max: number) {
    return min + (Math.random() * (max - min));
}

async function testLoop(item: Item) {
    if (await tryCheckItem(item, false)) {
        console.log(`[${item.name}] TEST OK!`);
    }

    const sleepTime = getSleepTime(minSleepTest, maxSleepTest) * (item.sleepMultiplier || 1);
    setTimeout(testLoop, sleepTime, item);
}

async function itemLoop(item: Item) {
    const sleepTime = getSleepTime(minSleep, maxSleep) * (item.sleepMultiplier || 1);
    await delay(sleepTime);

    await tryCheckItem(item, true);

    setImmediate(itemLoop, item);
}

function parseEnvArray(name: string) {
    const env = process.env[name];
    if (!env) {
        return [];
    }
    return env.split(',');
}

function parseEnvArrayLower(name: string) {
    return parseEnvArray(name).map(x => x.toLowerCase());
}

const disabledStores = new Set(parseEnvArrayLower('DISABLED_STORES'));
const enabledProducts = new Set(parseEnvArrayLower('ENABLED_PRODUCTS'));

async function main() {
    await initStores();
    if (!(await refreshProxyLoop())) {
        throw Error('Failed to load initial proxies');
    }

    const items = loadAllItems();
    const tests = loadTestItems();

    const enabledItems = items
        .filter(i => !disabledStores.has(i.storeName.toLowerCase()))
        .filter(i => enabledProducts.has(i.productName.toLowerCase()));

    const neededStores: Set<string> = new Set();
    enabledItems.forEach(i => neededStores.add(i.storeName));
    const enabledTests = tests.filter(t => neededStores.has(t.storeName));

    const enabledItemNames = new Set(enabledItems.map(i => i.name));
    enabledTests.forEach(t => enabledItemNames.add(t.name));
    for (const k of Object.keys(ITEMS_MAP)) {
        if (!enabledItemNames.has(k)) {
            delete ITEMS_MAP[k];
        }
    }

    for (const k of Object.keys(LAST_STATUS_MAP)) {
        if (ITEMS_MAP[k]) {
            continue;
        }
        delete LAST_STATUS_MAP[k];
    }
    setFullyInited();
    console.log('INIT DONE');

    await Promise.all(enabledTests.map(t => testLoop(t)));
    await Promise.all(enabledItems.map(m => itemLoop(m)));

    console.log('FIRSTRUN DONE');

    await notify('Query-Finder startup completed!', {
        disable_notification: true,
    });
}

main()
    .catch((e) => {
        console.error(e.stack || e);
        process.exit(1);
    });
