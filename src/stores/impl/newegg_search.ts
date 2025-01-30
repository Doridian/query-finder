import { ItemImpl } from '../../types.js';
import { StoreItemConfig } from '../index.js';

export function factory(cfg: StoreItemConfig): ItemImpl {
    return {
        url: `https://www.newegg.com/p/pl?d=${cfg.sku}`,
        dataType: 'text',
        matcher: 'text_contains',
        path: '',
        value: ['Add to cart'],
        notifyOnResult: 'all',
        needProxy: true,
        //randomQueryParam: 'r',
    };
}

export const test = {
    sku: '3800x',
};
