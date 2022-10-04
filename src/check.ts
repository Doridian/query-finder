import { ElementNotFoundError, Item, Status, StatusType } from './types.js';
import { HttpError, getItemPage } from './http.js';
import { LAST_STATUS_MAP, writeStatus } from './globals.js';
import { endDateRange, typeToDateRange } from './date.js';
import { mkdirSync, writeFile } from 'fs';

import { config } from './config.js';
import { delay } from './util.js';
import { notify } from './notifiers/index.js';

const LAST_DIR = process.env.LAST_DIR || './last';

mkdirSync(LAST_DIR, { recursive: true });

const hardTimeout = parseInt(config.HARD_TIMEOUT!, 10);

type ItemMatcher = (data: any, path: any, value: any) => boolean | Promise<boolean>;

const itemMatcherType: { [key: string]: ItemMatcher } = {
    object(data: any, path: string, value: any) {
        const pathSplit = path.split('.');
        let curData = data;
        for (const ele of pathSplit) {
            const nextData = curData[ele];
            if (nextData === undefined) {
                throw new ElementNotFoundError(`NOT FOUND: Selector: ${path}; Element ${ele}; Data: ${JSON.stringify(curData)}`);
            }
            curData = nextData;
        }
        return curData === value;
    },

    text_contains(data: string, _path: string, value: any) {
        return data.includes(value);
    },
};

type DataType = (data: string) => any | Promise<any>;

const dataTypeDecoder: { [key: string]: DataType } = {
    text(dataStr: string) {
        return dataStr;
    },

    json(dataStr: string) {
        return JSON.parse(dataStr);
    },
};

async function checkItem(item: Item, status: Status) {
    const res = await getItemPage(item, status);
    const dataStr = await res.text();
    const data = await dataTypeDecoder[item.dataType](dataStr);

    writeFile(`${LAST_DIR}/${item.name}.${item.dataType}`, dataStr, (err) => {
        if (err) console.error(err);
    });

    const matcher = itemMatcherType[item.matcher];

    if (!data) {
        throw new ElementNotFoundError('Blank data');
    }

    const result = await matcher(data, item.path, item.value);
    if (item.errorValue) {
        const errorResult = await matcher(data, item.path, item.errorValue);
        if (errorResult) {
            throw new Error('Error condition found');
        }
    }

    return result;
}

export async function tryCheckItem(item: Item, allowNotify: boolean) {
    let result = false;
    let errored = false;
    const curStatus: Status = LAST_STATUS_MAP[item.name] || {
        lastError: 'Not fetched yet',
        fetchState: 'initial',
        date: new Date(),
        type: 'error'
    };

    try {
        const matches = await Promise.race([
            delay(hardTimeout).then(() => { throw new Error(`Hard timeout in fetchState ${curStatus.fetchState}`) }),
            checkItem(item, curStatus),
        ]);
        if (matches === item.notifyOnResult) {
            result = true;
            if (allowNotify) {
                console.log(`[${item.name}] FOUND!`);
                // Do not await this!
                notify(item).catch((err: any) => {
                    console.error(err);
                });
            }
        } else {
            if (allowNotify) {
                console.log(`[${item.name}] NOT FOUND!`);
            }
        }
    } catch(e) {
        errored = true;
        if (e instanceof HttpError) {
            curStatus.lastError = `HTTP error: ${e.code}`;
        } else {
            curStatus.lastError = `Exception: ${e}`;
            console.error((e as any).stack || e);
        }
        console.error(`[${item.name}] ${curStatus.lastError}`);
    }

    curStatus.date = new Date();
    let curType: StatusType;
    if (result) {
        curType = 'instock';
    } else if (errored) {
        curType = 'error';
    } else {
        curType = 'outofstock';
    }

    if (curType !== 'error') {
        endDateRange(curStatus, 'error', curStatus.date);
        endDateRange(curStatus, (curType === 'instock') ? 'outofstock' : 'instock', curStatus.date);
    }
    
    if (curStatus.type !== curType) {
        curStatus.type = curType;
        const useDateRange = typeToDateRange(curStatus, curType);
        if (!useDateRange.start || useDateRange.end) {
            useDateRange.start = curStatus.date;
        }
        useDateRange.end = undefined;
    }

    LAST_STATUS_MAP[item.name] = curStatus;
    
    writeStatus();

    return result;
}
