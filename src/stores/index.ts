import { readdirSync, readFileSync } from 'fs';
import { ITEMS_MAP } from '../globals';
import { Item } from '../types';
import { join } from 'path';

export interface StoreItemConfig {
    store: string;
    name: string;
    sku: string;
}
export interface StoreItemDescConfig extends StoreItemConfig {
    desc: string;
}

type StoreItemFactoryFunc = (config: StoreItemConfig) => Omit<Item, 'storeName' | 'productName' | 'name'>;
const storeItemFactories: { [key: string]: StoreItemFactoryFunc } = {};
const storeTestItems: { [key: string]: Item } = {};

const dir = join(__dirname, 'impl');
const files = readdirSync(dir);
files.forEach(file => {
    if (file.charAt(0) === '.') {
        return;
    }
    const name = file.split('.')[0];
    const cls = require(join(dir, file));
    cls.test.store = name;
    cls.test.name = 'test';
    storeItemFactories[name] = cls.factory as StoreItemFactoryFunc;
    const testItem = callItemFactory(cls.test);
    testItem.testmode = true;
    storeTestItems[name] = testItem;
});

function callItemFactory(config: StoreItemConfig): Item {
    const storeName = config.store;
    const factory = storeItemFactories[storeName];
    if (!factory) {
        throw new Error(`Unknown store ${storeName}`);
    }
    const item = {
        ...factory(config),
        name: `${storeName} ${config.name}`,
        productName: config.name,
        storeName,
        testmode: false,
    };
    if (ITEMS_MAP[item.name]) {
        throw new Error(`Duplicate item ${item.name}`);
    }
    ITEMS_MAP[item.name] = item;
    return item;
}

export function loadTestItems() {
    return Object.values(storeTestItems);
}

export function loadAllItems() {
    const dir = 'items';
    const files = readdirSync(dir);
    let res: Item[] = [];
    files.forEach(file => {
        if (file.charAt(0) === '.') {
            return;
        }
        res = res.concat(loadItems(join(dir, file)));
    });
    return res;
}

export function loadItems(file: string) {
    const data = JSON.parse(readFileSync(file, 'utf8')) as StoreItemConfig[];
    const items: Item[] = [];
    for (const d of data) {
        const i = callItemFactory(d);
        items.push(i);
    }
    return items;
}
