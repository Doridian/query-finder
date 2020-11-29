import { MatcherBaseConfig } from '..';

export function factory(cfg: MatcherBaseConfig) {
    return {
        name: cfg.name,
        url: `https://www.amazon.com/dp/${cfg.sku}`,
        dataType: 'text',
        matcher: 'text_contains',
        path: '',
        value: 'id="addToCart_feature_div"',
        errorValue: '/errors/validateCaptcha',
        notifyOnResult: true,
        needH2: false,
        needProxy: true,
        sleepMultiplier: 5,
    };
}
