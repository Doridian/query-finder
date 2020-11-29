import { MatcherBaseConfig } from '..';

export function factory(cfg: MatcherBaseConfig) {
    return {
        name: cfg.name,
        url: `https://www.amd.com/en/direct-buy/${cfg.sku}/us`,
        dataType: 'text',
        matcher: 'text_contains',
        path: '',
        value: 'href="/en/direct-buy/add-to-cart/',
        notifyOnResult: true,
        needH2: false,
        needProxy: false,
        //randomQueryParam: 'r',
    };
}
