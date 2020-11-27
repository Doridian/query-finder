import { SocksProxyAgent } from 'socks-proxy-agent';
import { RequestOptions, request as h1request, Agent } from 'https';
import { ServerResponse } from 'http';
import { parse } from 'url';
import { inflate, brotliDecompress, gunzip } from 'zlib';
import { promisify } from 'util';
import { Item } from './types';
const { request: h2request } = require('http2-client');

const inflateAsync = promisify(inflate);
const brotliDecompressAsync = promisify(brotliDecompress);
const gunzipAsync = promisify(gunzip);

export interface MyResponse {
    status: number;
    text(): string | Promise<string>;
}

export class HttpError extends Error {
    constructor(public code: number, public body: string) {
        super(`HTTP Code: ${code}`);
    }
}

function getProxyAgent() {
    return new SocksProxyAgent({
        host: process.env.PROXY_HOST,
        userId: process.env.PROXY_USER,
        password: process.env.PROXY_PASSWORD,
        timeout: 10000,
    });
}

function getAgent() {
    return new Agent({
        timeout: 10000,
    })
}

function getUserAgent() {
    return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.198 Safari/537.36 Edg/86.0.622.69';
}

async function fetchCustom(item: Item) {
    const opts = parse(item.url) as RequestOptions;
    if (item.randomQueryParam) {
        let ch = opts.path?.includes('?') ?  '&' : '?';
        opts.path += `${ch}${item.randomQueryParam}=${Date.now()}`;
    }
    opts.timeout = 10000;
    if (item.needProxy) {
        opts.agent = getProxyAgent();
    } else {
        opts.agent = getAgent();
    }
    opts.method = 'GET';
    opts.headers = {
        'Accept-Encoding': 'gzip, deflate, br',
        'User-Agent': getUserAgent(),
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
    };
    return new Promise<MyResponse>((resolve, reject) => {
        const request = item.needH2 ? h2request : h1request;
        const req = request(opts, (res: ServerResponse) => {
            const chunks: Buffer[] = [];
            res.on('data', chunk => {
                chunks.push(Buffer.from(chunk));
            });
            res.on('end', async () => {
                const allChunks = Buffer.concat(chunks);

                let data: Buffer;
                const encoding = (res as any).headers['content-encoding'] || 'identity';

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

                resolve({
                    status: res.statusCode || 599,
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
