import { DateRange, Status, StatusType } from './types';

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
