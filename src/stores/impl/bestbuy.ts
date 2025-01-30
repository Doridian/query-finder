import { ItemImpl } from '../../types.js';
import { StoreItemConfig, StoreItemDescConfig } from '../index.js';

const BESTBUY_ZIP = 98034;
const BESTBUY_STORE = 498;
export function factory(cfg: StoreItemConfig): ItemImpl {
    return {
        url: `https://www.bestbuy.com/api/tcfb/model.json?paths=%5B%5B%22shop%22%2c%22buttonstate%22%2c%22v5%22%2c%22item%22%2c%22skus%22%2c${cfg.sku}%2c%22conditions%22%2c%22NONE%22%2c%22destinationZipCode%22%2c${BESTBUY_ZIP}%2c%22storeId%22%2c%20${BESTBUY_STORE}%2c%22context%22%2c%22cyp%22%2c%22addAll%22%2c%22false%22%5D%5D&method=get`,
        browserUrl: `https://www.bestbuy.com/site/${(cfg as StoreItemDescConfig).desc}/${cfg.sku}.p?skuId=${cfg.sku}`,
        dataType: 'json',
        matcher: 'object',
        path: `jsonGraph.shop.buttonstate.v5.item.skus.${cfg.sku}.conditions.NONE.destinationZipCode.${BESTBUY_ZIP}.storeId.${BESTBUY_STORE}.context.cyp.addAll.false.value.buttonStateResponseInfos.0.buttonState`,
        value: ['COMING_SOON', 'SOLD_OUT'],
        notifyOnResult: false,
        needProxy: false,
        //randomQueryParam: 'r',
    };
}

export const test = {
    sku: '6247254',
    desc: 'insignia-32-class-led-hd-smart-fire-tv-edition-tv',
};
