import { ItemImpl } from '../../types.js';
import { StoreItemConfig } from '../index.js';

export function factory(cfg: StoreItemConfig): ItemImpl {
    return {
        url: `https://www.antonline.com/${cfg.sku}`,
        dataType: 'text',
        matcher: 'text_contains',
        path: '',
        value: ['>Add to Cart</button>'],
        notifyOnResult: 'all',
        needProxy: false,
        statusCodes: [200, 404]
    };
}

export const test = {
    sku: 'Microsoft/Accessories/Hardware_Connectivity/Connector_Adapters/1400386',
};
