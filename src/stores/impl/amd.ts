import { StoreItemConfig } from '../index.js';

export function factory(cfg: StoreItemConfig) {
    return {
        url: `https://www.amd.com/en/direct-buy/${cfg.sku}/us`,
        dataType: 'text',
        matcher: 'text_contains',
        path: '',
        value: 'href="/en/direct-buy/add-to-cart/',
        notifyOnResult: true,
        needProxy: false,
        //randomQueryParam: 'r',
    };
}

export const test = {
    sku: '5358857400',
};
