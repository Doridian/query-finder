import { readdirSync, readFileSync } from 'fs';
import { ITEMS_MAP } from '../globals';
import { Item } from '../types';
import { join } from 'path';

export interface MatcherBaseConfig {
    type: string;
    name: string;
    sku: string;
    enabled: boolean;
}
export interface MatcherWithDescConfig extends MatcherBaseConfig {
    desc: string;
}

type MatcherFunc = (config: MatcherBaseConfig) => Item;
const MATCHER_TYPES: { [key: string]: MatcherFunc } = {};
const TEST_ITEMS: { [key: string]: Item } = {};

const dir = join(__dirname, 'impl');
const files = readdirSync(dir);
files.forEach(file => {
    if (file.charAt(0) === '.') {
        return;
    }
    const name = file.split('.')[0];
    const m = require(join(dir, file));
    const mf = m.factory as MatcherFunc;
    MATCHER_TYPES[name] = mf
    TEST_ITEMS[name] = mf(m.test);
});

export function loadTestItems() {
    return Object.values(TEST_ITEMS);
}

export function loadAllItems() {
    const dir = 'matchers';
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
    const data = JSON.parse(readFileSync(file, 'utf8')) as MatcherBaseConfig[];
    const matchers: Item[] = [];
    for (const d of data) {
        if (!d.enabled) {
            continue;
        }
        const m = MATCHER_TYPES[d.type];
        if (!m) {
            console.error(`Unknown matcher type ${d.type}. Ignoring.`);
            continue;
        }
        const i = m(d);
        if (ITEMS_MAP[i.name]) {
            console.error(`Duplicate item name ${i.name}. Ignoring.`);
            continue;
        }
        ITEMS_MAP[i.name] = i;
        matchers.push(i);
    }
    return matchers;
}
