import { StoreItemConfig, StoreItemDescConfig } from '..';

export function factory(cfg: StoreItemConfig) {
    return {
        url: `https://store.steampowered.com/app/${cfg.sku}/${(cfg as StoreItemDescConfig).desc}/`,
        dataType: 'text',
        matcher: 'text_contains',
        path: '',
        value: 'id="btn_add_to_cart_',
        notifyOnResult: true,
        needProxy: false,
    };
}

export const test = {
    sku: '1072820',
    desc: 'Face_Gasket_for_Valve_Index_Headset__2_Pack',
};
