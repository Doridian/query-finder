export interface DateRange {
    start?: Date;
    end?: Date;
}

export type StatusType = 'instock' | 'outofstock' | 'error';
export interface Status {
    lastError: string;
    fetchState: string;
    type: StatusType;
    date: Date;
    dateLastStock?: DateRange;
    dateLastError?: DateRange;
    dateLastOutOfStock?: DateRange;
}

export type ItemDataType = 'json' | 'text';
export type ItemMatcherType = 'object' | 'text_contains' | 'regexp_stock_level';

export interface Item {
    name: string;
    url: string;
    browserUrl?: string;
    storeName: string;
    productName: string;
    dataType: ItemDataType;
    matcher: ItemMatcherType;
    path: string;
    value: string[] | number[] | boolean[];
    errorValue?: string[] | number[] | boolean[];
    notifyOnResult: boolean;
    testmode?: boolean;
    statusCodes?: number[];
    sleepMultiplier?: number;
    needProxy: boolean;
    randomQueryParam?: string;
}

export type ItemImpl = Omit<Item, 'storeName' | 'productName' | 'name'>;

export class ElementNotFoundError extends Error { }