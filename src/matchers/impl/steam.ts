import { MatcherBaseConfig, MatcherWithDescConfig } from '..';

export function factory(cfg: MatcherBaseConfig) {
    return {
        name: cfg.name,
        url: `https://store.steampowered.com/app/${cfg.sku}/${(cfg as MatcherWithDescConfig).desc}/`,
        dataType: 'text',
        matcher: 'text_contains',
        path: '',
        value: 'id="btn_add_to_cart_',
        notifyOnResult: true,
        needProxy: false,
    };
}
