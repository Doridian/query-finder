import { ItemImpl } from '../../types.js';
import { StoreItemConfig, StoreItemDescConfig } from '../index.js';

export function factory(cfg: StoreItemConfig): ItemImpl {
    return {
        url: `https://www.newegg.com/product/api/ProductRealtime?ItemNumber=${cfg.sku}`,
        browserUrl: `https://www.newegg.com/${(cfg as StoreItemDescConfig).desc}/p/${cfg.sku}?Item=${cfg.sku}`,
        dataType: 'json',
        matcher: 'object',
        path: 'MainItem.Instock',
        value: [true],
        notifyOnResult: 'all',
        needProxy: true,
        //randomQueryParam: 'r',
    };
}

export const test = {
    sku: 'N82E16820250109',
    desc: 'western-digital-black-sn750-nvme-500gb',
};
