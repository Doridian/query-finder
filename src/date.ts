import { DateRange, Status, StatusType } from './types';

const ONE_MINUTE = 60;
const ONE_HOUR = 60 * ONE_MINUTE;
const ONE_DAY = 24 * ONE_HOUR;
const MAX_TIME_AGO = 30 * ONE_DAY;
export function formatDateRange(dateRange?: DateRange) {
    if (!dateRange || !dateRange.start) {
        return '<span>-</span>';
    }

    if (!dateRange.end) {
        return formatDateDiff(dateRange.start, undefined, undefined, 'Since ');
    }

    return `${formatDateDiff(dateRange.start)} - ${formatDateDiff(dateRange.end)} (${formatDateDiff(dateRange.start, dateRange.end, '')})`;
}

export function formatDateDiff(date: Date, relativeTo: Date = new Date(), suffix: string = ' ago', prefix: string = '') {
    let diff = Math.floor((relativeTo.getTime() - date.getTime()) / 1000);
    if (diff > MAX_TIME_AGO) {
        return `<span>${date.toISOString()}</span>`;
    }

    let strArray: string[] = [];
    let diffOrders = 0;
    if (diff >= ONE_DAY) {
        strArray.push(`${Math.floor(diff / ONE_DAY)}d`);
        diff %= ONE_DAY;
        if (diffOrders < 3)
            diffOrders = 3;
    }
    if (diff >= ONE_HOUR) {
        strArray.push(`${Math.floor(diff / ONE_HOUR)}h`);
        diff %= ONE_HOUR;
        if (diffOrders < 2)
            diffOrders = 2;
    }
    if (diff >= ONE_MINUTE) {
        strArray.push(`${Math.floor(diff / ONE_MINUTE)}m`);
        diff %= ONE_MINUTE;
        if (diffOrders < 1)
            diffOrders = 1;
    }
    strArray.push(`${diff}s`);

    return `<span class="diff-${diffOrders}">${prefix}${strArray.join(' ')}${suffix}</span>`;
}

export function typeToDateRange(curStatus: Status, curType: StatusType): DateRange {
    switch (curType) { 
        case 'instock':
            if (!curStatus.dateLastStock) {
                curStatus.dateLastStock = {};
            }
            return curStatus.dateLastStock;
        case 'outofstock':
            if (!curStatus.dateLastOutOfStock) {
                curStatus.dateLastOutOfStock = {};
            }
            return curStatus.dateLastOutOfStock;
        case 'error':
            if (!curStatus.dateLastError) {
                curStatus.dateLastError = {};
            }
            return curStatus.dateLastError;
        default:
            return {};
    }
}

export function endDateRange(curStatus: Status, curType: StatusType, date: Date) {
    const range = typeToDateRange(curStatus, curType);
    if (range.end) {
        return;
    }
    range.end = date;
}
