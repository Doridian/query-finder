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

export const test = {
    type: 'steam',
    name: 'Steam Test',
    sku: '1072820',
    desc: 'Face_Gasket_for_Valve_Index_Headset__2_Pack',
};
