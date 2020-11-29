import { SocksProxyAgent } from 'socks-proxy-agent';
import { RequestOptions, request as h1request, Agent } from 'https';
import { IncomingMessage, ServerResponse } from 'http';
import { parse } from 'url';
import { inflate, brotliDecompress, gunzip } from 'zlib';
import { promisify } from 'util';
import { FetchItem, Item } from './types';
const { request: h2request } = require('http2-client');

const softTimeout = parseInt(process.env.SOFT_TIMEOUT!, 10);

const inflateAsync = promisify(inflate);
const brotliDecompressAsync = promisify(brotliDecompress);
const gunzipAsync = promisify(gunzip);

export interface MyResponse {
    status: number;
    headers: { [key: string]: string | string[] | undefined };
    text(): string | Promise<string>;
}

export class HttpError extends Error {
    constructor(public code: number, public body: string) {
        super(`HTTP Code: ${code}`);
    }
}

const proxyAgent = new SocksProxyAgent({
    host: process.env.PROXY_HOST,
    userId: process.env.PROXY_USER,
    password: process.env.PROXY_PASSWORD,
    timeout: softTimeout,
});
function getProxyAgent() {
    return proxyAgent;
}

const agent = new Agent({
    timeout: softTimeout,
});
function getAgent() {
    return agent;
}

function getUserAgent() {
    return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.67 Safari/537.36 Edg/87.0.664.47';
}

export async function fetchCustom(item: FetchItem) {
    const opts = parse(item.url) as RequestOptions;
    if (item.randomQueryParam) {
        let ch = opts.path?.includes('?') ?  '&' : '?';
        opts.path += `${ch}${item.randomQueryParam}=${Date.now()}`;
    }
    opts.timeout = softTimeout;
    if (item.needProxy) {
        opts.agent = getProxyAgent();
    } else {
        opts.agent = getAgent();
    }
    opts.method = 'GET';
    opts.headers = {
        'accept-encoding': 'gzip, deflate, br',
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        'accept-language': 'en-US,en;q=0.9',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none',
        'sec-fetch-user': '?1',
        'upgrade-insecure-requests': '1',
        'user-agent': getUserAgent(),
        'cache-control': 'no-cache',
        'pragma': 'no-cache',
    };

    item.fetchState = 'start';

    return new Promise<MyResponse>((resolve, reject) => {
        const request = item.needH2 ? h2request : h1request;
        item.fetchState = 'started';

        const req = request(opts, (res: IncomingMessage) => {
            const chunks: Buffer[] = [];
            item.fetchState = 'bodystart';

            res.on('data', chunk => {
                chunks.push(Buffer.from(chunk));
                item.fetchState = `bodychunk ${chunks.length}`;
            });
            res.on('end', async () => {
                item.fetchState = 'end';

                const allChunks = Buffer.concat(chunks);

                let data: Buffer;
                const encoding = res.headers['content-encoding'] || 'identity';

                switch (encoding) {
                    case 'identity':
                    default:
                        data = allChunks;
                        break;
                    case 'gzip':
                        data = await gunzipAsync(allChunks);
                        break;
                    case 'br':
                        data = await brotliDecompressAsync(allChunks);
                        break;
                    case 'deflate':
                        data = await inflateAsync(allChunks);
                        break;
                }

                const dataStr = data.toString('utf8');

                item.fetchState = 'done';

                resolve({
                    status: res.statusCode || 599,
                    headers: res.headers,
                    text() {
                        return dataStr;
                    },
                });
            });
        });
        req.on('error', reject);
        req.end();
    });
}

const DEFAULT_STATUS_CODES = [200];

export async function getItemPage(item: Item) {
    const res = await fetchCustom(item);
    if ((item.statusCodes || DEFAULT_STATUS_CODES).includes(res.status)) {
        return res;
    }
    throw new HttpError(res.status, await res.text());
}
