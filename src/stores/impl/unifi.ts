import { ItemImpl } from '../../types.js';
import { StoreItemConfig } from '../index.js';

export function factory(cfg: StoreItemConfig): ItemImpl {
    return {
        url: `https://store.ui.com/collections/${cfg.sku}`,
        dataType: 'text',
        matcher: 'regexp_stock_level',
        path: '',
        value: ['quantity: (-?[0-9]+),'],
        notifyOnResult: 'all',
        needProxy: true,
    };
}

export const test = {
    sku: 'unifi-accessories/products/unifi-g4-instant-cover',
};
