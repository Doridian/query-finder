export interface DateRange {
    start?: Date;
    end?: Date;
}

export type StatusType = 'instock' | 'outofstock' | 'error';
export interface Status {
    text: string;
    type: StatusType;
    date: Date;
    dateLastStock?: DateRange;
    dateLastError?: DateRange;
    dateLastOutOfStock?: DateRange;
}

export type ItemDataType = 'json' | 'html' | 'text';
export type ItemMatcherType = 'object' | 'dom_text_contains' | 'text_contains';

export interface Item {
    url: string;
    needH2: boolean;
    needProxy: boolean;
    randomQueryParam?: string;
    name: string;
    browserUrl?: string;
    dataType: ItemDataType;
    matcher: ItemMatcherType;
    path: string;
    value: string | number | boolean;
    errorValue?: string | number | boolean;
    notifyOnResult: boolean;
    testmode?: boolean;
    statusCodes?: number[];
}

export class ElementNotFoundError extends Error { }