import { ItemImpl } from '../../types.js';
import { StoreItemConfig } from '../index.js';

export function factory(cfg: StoreItemConfig): ItemImpl {
    return {
        url: `https://www.amazon.com/dp/${cfg.sku}`,
        dataType: 'text',
        matcher: 'text_contains',
        path: '',
        value: ['id="addToCart_feature_div"'],
        errorValue: ['/errors/validateCaptcha'],
        notifyOnResult: true,
        needProxy: true,
    };
}

export const test = {
    sku: 'B07D998212',
};
