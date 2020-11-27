import { MatcherBaseConfig } from '..';

export function factory(cfg: MatcherBaseConfig) {
    return {
        name: cfg.name,
        url: `https://www.antonline.com/${cfg.sku}`,
        dataType: 'text',
        matcher: 'text_contains',
        path: '',
        value: '>Add to Cart</button>',
        notifyOnResult: true,
        needH2: false,
        needProxy: false,
        statusCodes: [200, 404]
    };
}
