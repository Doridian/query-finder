require('dotenv').config();

import { Item } from './types';
import { ITEMS_MAP, LAST_STATUS_MAP, setFullyInited } from './globals';
import { startWebUI } from './webui';
import { loadAllItems, loadTestItems } from './stores';
import { tryCheckItem } from './check';
import { refreshProxyLoop } from './proxy';
import { test } from './stores/impl/amazon';

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
    await refreshProxyLoop();

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

    await Promise.all(enabledTests.map(t => testLoop(t)));
    await Promise.all(enabledItems.map(m => itemLoop(m)));
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
