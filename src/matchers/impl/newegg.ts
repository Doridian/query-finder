import { MatcherBaseConfig, MatcherWithDescConfig } from '..';

export function factory(cfg: MatcherBaseConfig) {
    return {
        name: cfg.name,
        url: `https://www.newegg.com/product/api/ProductRealtime?ItemNumber=${cfg.sku}`,
        browserUrl: `https://www.newegg.com/${(cfg as MatcherWithDescConfig).desc}/p/${cfg.sku}?Item=${cfg.sku}`,
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
    type: 'newegg',
    name: 'NewEgg Test',
    sku: 'N82E16820250109',
    desc: 'western-digital-black-sn750-nvme-500gb',
};
