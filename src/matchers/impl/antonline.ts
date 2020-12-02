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
        needProxy: false,
        statusCodes: [200, 404]
    };
}

export const test = {
    type: 'antonline',
    name: 'antOnline Test',
    sku: 'Microsoft/Accessories/Hardware_Connectivity/Connector_Adapters/1400386',
};
