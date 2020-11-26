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
        needH2: false,
        needProxy: true,
        //randomQueryParam: 'r',
    };
}
