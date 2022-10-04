import { StoreItemConfig } from '../index.js';

export function factory(cfg: StoreItemConfig) {
    return {
        url: `https://store.ui.com/collections/${cfg.sku}`,
        dataType: 'text',
        matcher: 'text_contains',
        path: '',
        value: 'quantity: 0,',
        notifyOnResult: false,
        needProxy: true,
    };
}

export const test = {
    sku: 'unifi-accessories-psu/products/u-mps-350w-ac',
};
