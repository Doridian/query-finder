import { ItemImpl } from '../../types.js';
import { StoreItemConfig, StoreItemDescConfig } from '../index.js';

export function factory(cfg: StoreItemConfig): ItemImpl {
    return {
        url: `https://www.bhphotovideo.com/c/product/${cfg.sku}/${(cfg as StoreItemDescConfig).desc}.html`,
        dataType: 'text',
        matcher: 'text_contains',
        path: '',
        value: ['data-selenium="stockStatus">In Stock</span>'],
        notifyOnResult: true,
        needProxy: true
    };
}

export const test = {
    sku: '751035-REG',
    desc: 'Pearstone_hda_106_Standard_Series_HDMI_to',
};
