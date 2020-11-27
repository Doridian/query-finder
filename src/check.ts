import { writeFile } from 'fs';
import { JSDOM } from 'jsdom';
import { endDateRange, typeToDateRange } from './date';
import { LAST_STATUS_MAP, writeStatus } from './globals';
import { getItemPage, HttpError } from './http';
import { notify } from './notifiers';
import { ElementNotFoundError, Item, Status, StatusType } from './types';

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

    dom_text_contains(data: JSDOM, path: string, value: any) {
        const ele = data.window.document.querySelector(path);
        if (!ele) {
            throw new ElementNotFoundError(`NOT FOUND: Selector ${path}; Data: ${data.window.document.body.innerHTML}`);
        }
        return ele.textContent.toLowerCase().includes(value);
    },

    text_contains(data: string, _path: string, value: any) {
        return data.includes(value);
    },
};

type DataType = (data: string) => any | Promise<any>;

const dataTypeDecoder: { [key: string]: DataType } = {
    html(dataStr: string) {
        return new JSDOM(dataStr);
    },

    text(dataStr: string) {
        return dataStr;
    },

    json(dataStr: string) {
        return JSON.parse(dataStr);
    },
};

async function checkItem(item: Item) {
    const res = await getItemPage(item);
    const dataStr = await res.text();
    const data = await dataTypeDecoder[item.dataType](dataStr);

    writeFile(`last/${item.name}.${item.dataType}`, dataStr, (err) => {
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
    let status = 'N/A';
    let result = false;
    let errored = false;
    const curStatus: Status = LAST_STATUS_MAP[item.name] || { text: '', date: '', type: 'error' };

    try {
        const matches = await checkItem(item);
        if (matches === item.notifyOnResult) {
            status = 'In stock';
            result = true;
            if (allowNotify) {
                console.log(`[${item.name}] FOUND!`);
                // Do not await this!
                notify(item).catch((err: any) => {
                    console.error(err);
                });
            }
        } else {
            status = 'Out of stock';
            if (allowNotify) {
                console.log(`[${item.name}] NOT FOUND!`);
            }
        }
    } catch(e) {
        errored = true;
        if (e instanceof HttpError) {
            status = `HTTP error: ${e.code}`;
        } else {
            status = `Exception: ${e}`;
            console.error(e.stack || e);
        }
        console.error(`[${item.name}] ${status}`);
    }

    curStatus.text = status;
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