import { MatcherBaseConfig, MatcherWithDescConfig } from '..';

const BESTBUY_ZIP = 98052;
const BESTBUY_STORE = 498;
export function factory(cfg: MatcherBaseConfig) {
    return {
        name: cfg.name,
        url: `https://www.bestbuy.com/api/tcfb/model.json?paths=%5B%5B%22shop%22%2c%22buttonstate%22%2c%22v5%22%2c%22item%22%2c%22skus%22%2c${cfg.sku}%2c%22conditions%22%2c%22NONE%22%2c%22destinationZipCode%22%2c${BESTBUY_ZIP}%2c%22storeId%22%2c%20${BESTBUY_STORE}%2c%22context%22%2c%22cyp%22%2c%22addAll%22%2c%22false%22%5D%5D&method=get`,
        browserUrl: `https://www.bestbuy.com/site/${(cfg as MatcherWithDescConfig).desc}/${cfg.sku}.p?skuId=${cfg.sku}`,
        dataType: 'json',
        matcher: 'object',
        path: `jsonGraph.shop.buttonstate.v5.item.skus.${cfg.sku}.conditions.NONE.destinationZipCode.${BESTBUY_ZIP}.storeId.${BESTBUY_STORE}.context.cyp.addAll.false.value.buttonStateResponseInfos.0.buttonState`,
        value: 'SOLD_OUT',
        notifyOnResult: false,
        needH2: true,
        needProxy: false,
        //randomQueryParam: 'r',
    };
}
