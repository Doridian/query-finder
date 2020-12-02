import { StoreItemConfig, StoreItemDescConfig } from '..';

export function factory(cfg: StoreItemConfig) {
    return {
        url: `https://www.newegg.com/product/api/ProductRealtime?ItemNumber=${cfg.sku}`,
        browserUrl: `https://www.newegg.com/${(cfg as StoreItemDescConfig).desc}/p/${cfg.sku}?Item=${cfg.sku}`,
        dataType: 'json',
        matcher: 'object',
        path: 'MainItem.Instock',
        value: true,
        notifyOnResult: true,
        needProxy: true,
        //randomQueryParam: 'r',
    };
}

export const test = {
    sku: 'N82E16820250109',
    desc: 'western-digital-black-sn750-nvme-500gb',
};
