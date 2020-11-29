import { readFileSync, writeFile } from 'fs';
import { Item, Status } from './types';

let FULLY_INITED = false;
export function isFullyInited() {
    return FULLY_INITED;
}

export function setFullyInited() {
    FULLY_INITED = true;
}

export function writeStatus() {
    writeFile('./status.json', JSON.stringify(LAST_STATUS_MAP), (err) => {
        if (!err) {
            return;
        }
        if (err.code === 'ENOENT') {
            return;
        }
        console.log(err.code);
        console.error(err);
    });
}

function loadStatus() {
    function reviver(_key: any , value: any) {
        if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{1,3}Z$/.test(value)) {
            return new Date(value);
        }

        return value;
    }
    let _status: { [key: string]: Status } = {};
    try {
        _status = JSON.parse(readFileSync('./status.json', 'utf8'), reviver);
    } catch (e) {
        console.error(e);
    }
    return _status;
}
export const LAST_STATUS_MAP: { [key: string]: Status } = loadStatus();

export const ITEMS_MAP: { [key: string]: Item } = {};
