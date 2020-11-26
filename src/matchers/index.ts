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

// TODO: Iterate over this shit
const dir = join(__dirname, 'impl');
const files = readdirSync(dir);
files.forEach(file => {
    if (file.charAt(0) === '.') {
        return;
    }
    const name = file.split('.')[0];
    MATCHER_TYPES[name] = require(join(dir, file)).factory as MatcherFunc;
});

export function loadMatchers(file: string) {
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
