import { StoreItemConfig } from '..';

export function factory(cfg: StoreItemConfig) {
    return {
        url: `https://www.newegg.com/p/pl?d=${cfg.sku}`,
        dataType: 'text',
        matcher: 'text_contains',
        path: '',
        value: 'Add to cart',
        notifyOnResult: true,
        needProxy: true,
        //randomQueryParam: 'r',
    };
}

export const test = {
    sku: '3800x',
};
