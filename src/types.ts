export interface DateRange {
    start?: Date;
    end?: Date;
}

export type StatusType = 'instock' | 'outofstock' | 'error';
export interface Status {
    lastError: string;
    type: StatusType;
    date: Date;
    dateLastStock?: DateRange;
    dateLastError?: DateRange;
    dateLastOutOfStock?: DateRange;
}

export type ItemDataType = 'json' | 'html' | 'text';
export type ItemMatcherType = 'object' | 'dom_text_contains' | 'text_contains';

export interface MinimalItem {
    name: string;
    url: string;
    browserUrl?: string;
}

export interface FetchItem {
    url: string;
    needProxy: boolean;
    randomQueryParam?: string;
    fetchState?: string;
}

export interface Item extends FetchItem, MinimalItem {
    dataType: ItemDataType;
    matcher: ItemMatcherType;
    path: string;
    value: string | number | boolean;
    errorValue?: string | number | boolean;
    notifyOnResult: boolean;
    testmode?: boolean;
    statusCodes?: number[];
    sleepMultiplier?: number;
}

export class ElementNotFoundError extends Error { }