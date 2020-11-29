import { FetchItem, Item } from './types';
import { Curl, HeaderInfo } from 'node-libcurl';

const softTimeout = parseInt(process.env.SOFT_TIMEOUT!, 10);

export interface MyResponse {
    status: number;
    headers: { [key: string]: string };
    text(): string | Promise<string>;
}

export class HttpError extends Error {
    constructor(public code: number, public body: string) {
        super(`HTTP Code: ${code}`);
    }
}

const proxyUrl = `socks5://${process.env.PROXY_USER}:${process.env.PROXY_PASSWORD}@${process.env.PROXY_HOST}`;

function getUserAgent() {
    return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.67 Safari/537.36 Edg/87.0.664.47';
}

export async function fetchCustom(item: FetchItem) {
    //const opts = parse(item.url) as RequestOptions;
    let url = item.url;
    if (item.randomQueryParam) {
        let ch = url.includes('?') ?  '&' : '?';
        url += `${ch}${item.randomQueryParam}=${Date.now()}`;
    }

    const curl = new Curl();
    curl.setOpt('URL', url);
    curl.setOpt('FOLLOWLOCATION', false);
    curl.setOpt('HTTPHEADER', [
        'accept-encoding: gzip, deflate, br',
        'accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        'accept-language: en-US,en;q=0.9',
        'sec-fetch-dest: document',
        'sec-fetch-mode: navigate',
        'sec-fetch-site: none',
        'sec-fetch-user: ?1',
        'upgrade-insecure-requests: 1',
        `user-agent: ${getUserAgent()}`,
        'cache-control: no-cache',
        'pragma: no-cache',
    ]);
    curl.setOpt('TIMEOUT_MS', softTimeout);
    if (item.needProxy) {
        curl.setOpt('PROXY', proxyUrl);
    }

    item.fetchState = 'start';

    return new Promise<MyResponse>((resolve, reject) => {
        curl.on('end', (status, data: string, curlHeaders: HeaderInfo[]) => {
            item.fetchState = 'done';
            curl.close();

            const headers: { [key: string]: string } = {};

            for (const hdr of curlHeaders) {
                for (const k of Object.keys(hdr)) {
                    headers[k.toLowerCase()] = hdr[k];
                }
            }

            resolve({
                status,
                headers,
                text() {
                    return data;
                },
            });
        });

        curl.on('error', (err: any) => {
            item.fetchState = 'errored';
            curl.close();
            reject(err);
        });

        curl.perform();

        item.fetchState = 'started';
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
