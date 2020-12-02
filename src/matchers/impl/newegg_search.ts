import { MatcherBaseConfig } from '..';

export function factory(cfg: MatcherBaseConfig) {
    return {
        name: cfg.name,
        url: `https://www.newegg.com/p/pl?d=${cfg.sku}`,
        dataType: 'text',
        matcher: 'text_contains',
        path: '',
        value: 'Add to cart',
        notifyOnResult: true,
        needProxy: true,
        //randomQueryParam: 'r',
    };
}

export const test = {
    type: 'newegg_search',
    name: 'NewEgg Search Test',
    sku: '3800x',
};
