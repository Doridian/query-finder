require('dotenv').config();

import { SocksProxyAgent } from 'socks-proxy-agent';
import { RequestOptions, request as h1request, Agent } from 'https';
import { ServerResponse, createServer } from 'http';
import { parse } from 'url';
import { JSDOM } from 'jsdom';
import { inflate, brotliDecompress, gunzip } from 'zlib';
import { promisify } from 'util';
import { writeFile, readFileSync } from 'fs';
const { request: h2request } = require('http2-client');
const TG = require('telegram-bot-api');

const inflateAsync = promisify(inflate);
const brotliDecompressAsync = promisify(brotliDecompress);
const gunzipAsync = promisify(gunzip);

interface DateRange {
    start?: Date;
    end?: Date;
}

type StatusType = 'instock' | 'outofstock' | 'error';
interface Status {
    text: string;
    type: StatusType;
    date: Date;
    dateLastStock?: DateRange;
    dateLastError?: DateRange;
    dateLastOutOfStock?: DateRange;
}

interface ItemUrl {
    url: string;
    needH2: boolean;
    needProxy: boolean;
    randomQueryParam?: string;
}

interface Item extends ItemUrl {
    name: string;
    browserUrl?: string;
    dataType: 'json' | 'html' | 'text';
    matcher: 'object' | 'dom_text_contains' | 'text_contains';
    path: string;
    value: string | number | boolean;
    errorValue?: string | number | boolean;
    notifyOnResult: boolean;
    testmode?: boolean;
}

interface MyResponse {
    status: number;
    text(): string;
}

class HttpError extends Error {
    constructor(public code: number, public body: string) {
        super(`HTTP Code: ${code}`);
    }
}

class ElementNotFoundError extends Error { }

let FULLY_INITED = false;

function loadStatus() {
    function reviver(_key: any , value: any) {
        if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{1,3}Z$/.test(value)) {
            return new Date(value);
        }

        return value;
    }
    let _status: { [key: string]: Status } = {};
    try {
        _status = JSON.parse(readFileSync('./last/_status.json', 'utf8'), reviver);
    } catch (e) {
        console.error(e);
    }
    return _status;
}
const LAST_STATUS_MAP: { [key: string]: Status } = loadStatus();
function writeStatus() {
    writeFile('./last/_status.json', JSON.stringify(LAST_STATUS_MAP), (err) => {
        if (err) console.error(err);
    })
}

const ITEMS_MAP: { [key: string]: Item } = {};

const ONE_MINUTE = 60;
const ONE_HOUR = 60 * ONE_MINUTE;
const ONE_DAY = 24 * ONE_HOUR;
const MAX_TIME_AGO = 30 * ONE_DAY;
function formatDateRange(dateRange?: DateRange) {
    if (!dateRange || !dateRange.start) {
        return '<span>-</span>';
    }

    const now = new Date();
    const start = dateRange.start;
    const end = dateRange.end || now;

    return `${formatDateDiff(start, now, ' ago')} - ${formatDateDiff(end, now, ' ago')} (${formatDateDiff(start, end, '')})`;
}

function formatDateDiff(date: Date, relativeTo: Date, suffix: string) {
    if (date === relativeTo) {
        return '<span class="diff-0">Now</span>';
    }
    let diff = Math.floor((relativeTo.getTime() - date.getTime()) / 1000);
    if (diff > MAX_TIME_AGO) {
        return `<span>${date.toISOString()}</span>`;
    }

    let strArray: string[] = [];
    let diffOrders = 0;
    if (diff >= ONE_DAY) {
        strArray.push(`${Math.floor(diff / ONE_DAY)}d`);
        diff %= ONE_DAY;
        if (diffOrders < 3)
            diffOrders = 3;
    }
    if (diff >= ONE_HOUR) {
        strArray.push(`${Math.floor(diff / ONE_HOUR)}h`);
        diff %= ONE_HOUR;
        if (diffOrders < 2)
            diffOrders = 2;
    }
    if (diff >= ONE_MINUTE) {
        strArray.push(`${Math.floor(diff / ONE_MINUTE)}m`);
        diff %= ONE_MINUTE;
        if (diffOrders < 1)
            diffOrders = 1;
    }
    strArray.push(`${diff}s`);

    return `<span class="diff-${diffOrders}">${strArray.join(' ')}${suffix}</span>`;
}

function generateTable(filter: (i: Item, v: Status) => boolean) {
    const htmlArray: string[] = [];

    for (const k of Object.keys(LAST_STATUS_MAP)) {
        const v = LAST_STATUS_MAP[k];
        const i = ITEMS_MAP[k];
        if (!i) {
            if (FULLY_INITED) {
                delete LAST_STATUS_MAP[k];
            }
            continue;
        }
        if (!filter(i, v)) {
            continue;
        }
        htmlArray.push(`<tr>
    <td scope="row"><a href="${i.browserUrl || i.url}" target="_blank">${k}</a></td>
    <td class="status-${v.type}">${v.text}</td>
    <td>${formatDate(v.date)}</td>
    <td>${formatDateRange(v.dateLastOutOfStock)}</td>
    <td>${formatDateRange(v.dateLastStock)}</td>
    <td>${formatDateRange(v.dateLastError)}</td>
</tr>`);
    }

    return htmlArray;
}

const srv = createServer((_req, res) => {
    const tableTests = generateTable(i => i.testmode!);
    const tableItems = generateTable(i => !i.testmode!);

    res.setHeader('Content-Type', 'text/html');
    res.write(`<!DOCTYPE html>
<html lang="en">
    <head>
        <title>Query-Finder</title>
        <meta http-equiv="refresh" content="5">
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@4.5.3/dist/css/bootstrap.min.css" integrity="sha384-TX8t27EcRE3e/ihU7zmQxVncDAy5uIKz4rEkgIXeMed4M0jlfIDPvg6uqKI2xXr2" crossorigin="anonymous">
        <style>
            .diff-3 {
                color: blue;
            }
            td.status-instock, .diff-2 {
                color: green;
            }
            td.status-outofstock, .diff-1 {
                color: orange;
            }
            td.status-error, .diff-0 {
                color: red;
            }
        </style>
    </head>
    <body>
        <div class="container-fluid">
            <h2>Items</h2>
            <table class="table">
                <thead>
                    <tr>
                        <th scope="col">Item</td>
                        <th scope="col">Status</td>
                        <th scope="col">Last check</td>
                        <th scope="col">Last OoS</td>
                        <th scope="col">Last Stock</td>
                        <th scope="col">Last Error</td>
                    </tr>
                </thead>
                <tbody>
                    ${tableItems.join('')}
                </tbody>
            </table>
            <h2>Tests</h2>
            <table class="table">
                <thead>
                    <tr>
                        <th scope="col">Item</td>
                        <th scope="col">Status</td>
                        <th scope="col">Last check</td>
                        <th scope="col">Last OoS</td>
                        <th scope="col">Last Stock</td>
                        <th scope="col">Last Error</td>
                    </tr>
                </thead>
                <tbody>
                    ${tableTests.join('')}
                </tbody>
            </table>
            <div class="alert alert-info" role="alert">
                Page generated at: ${(new Date()).toISOString()}
            </div>
        </div>
    </body>
</html>`);
    res.end();
});
srv.listen(process.env.PORT);

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

async function fetchCustom(item: ItemUrl) {
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

async function getUrl(item: Item) {
    const res = await fetchCustom(item);
    if (res.status >= 300) {
        throw new HttpError(res.status, await res.text());
    }
    return res;
}

async function checkObject(data: any, path: string, value: any) {
    if (!data) {
        throw new ElementNotFoundError('Blank data');
    }
    const pathSplit = path.split('.');
    let curData = data;
    for (const ele of pathSplit) {
        const nextData = curData[ele];
        if (nextData === undefined) {
            throw new ElementNotFoundError(`NOT FOUND: Selector: ${path}; Element ${ele}; Data: ${JSON.stringify(curData)}`);
        }
        curData = nextData;
    }
    return curData === value;
}

async function checkDOMTextContains(data: JSDOM, path: string, value: any) {
    if (!data) {
        throw new ElementNotFoundError('Blank data');
    }
    const ele = data.window.document.querySelector(path);
    if (!ele) {
        throw new ElementNotFoundError(`NOT FOUND: Selector ${path}; Data: ${data.window.document.body.innerHTML}`);
    }
    return ele.textContent.toLowerCase().includes(value);
}

async function checkPlainTextContains(data: string, path: string, value: any) {
    return data.includes(value);
}

async function checkItem(item: Item) {
    const res = await getUrl(item);
    const dataStr = await res.text();
    let data;
    switch (item.dataType) {
        case 'html':
            data = new JSDOM(dataStr);
            break;
        case 'text':
            data = dataStr;
            break;
        case 'json':
            data = JSON.parse(dataStr);
            break;
    }

    writeFile(`last/${item.name}.${item.dataType}`, dataStr, (err) => {
        if (err) console.error(err);
    });

    let matcher;
    switch (item.matcher) {
        case 'object':
            matcher = checkObject;
            break;
        case 'dom_text_contains':
            matcher = checkDOMTextContains;
            break;
        case 'text_contains':
            matcher = checkPlainTextContains;
            break;
    }

    const result = await matcher(data, item.path, item.value);
    if (item.errorValue) {
        const errorResult = await matcher(data, item.path, item.errorValue);
        if (errorResult) {
            throw new Error('Error condition found');
        }
    }

    writeFile(`last/${item.name}.${result}.${item.dataType}`, dataStr, (err) => {
        if (err) console.error(err);
    });

    return result;
}

const tgChatId = process.env.TELEGRAM_CHAT_ID;
const tgApi = new TG({
    token: process.env.TELEGRAM_ACCESS_TOKEN,
});

function typeToDateRange(curStatus: Status): DateRange {
    switch (curStatus.type) { 
        case 'instock':
            if (!curStatus.dateLastStock) {
                curStatus.dateLastStock = {};
            }
            return curStatus.dateLastStock;
        case 'outofstock':
            if (!curStatus.dateLastOutOfStock) {
                curStatus.dateLastOutOfStock = {};
            }
            return curStatus.dateLastOutOfStock;
        case 'error':
            if (!curStatus.dateLastError) {
                curStatus.dateLastError = {};
            }
            return curStatus.dateLastError;
        default:
            return {};
    }
}

async function tryCheckItem(item: Item, allowNotify: boolean) {
    let status = 'N/A';
    let result = false;
    let errored = false;
    const curStatus: Status = LAST_STATUS_MAP[item.name] || { text: '', date: '', type: 'error' };

    try {
        const matches = await checkItem(item);
        if (matches === item.notifyOnResult) {
            status = 'In stock';
            result = true;
            if (allowNotify) {
                console.log(`[${item.name}] FOUND!`);
            }

            if (allowNotify && curStatus.type === 'instock') {
                const notifyText = `FOUND: ${item.name} at ${item.browserUrl || item.url}`;
                // Do not await this!
                tgApi.sendMessage({
                    chat_id: tgChatId,
                    disable_web_page_preview: 'true',
                    text: notifyText,
                }).catch((err: any) => {
                    console.error(err);
                });
            }
        } else {
            status = 'Out of stock';
            if (allowNotify) {
                console.log(`[${item.name}] NOT FOUND!`);
            }
        }
    } catch(e) {
        errored = true;
        if (e instanceof HttpError) {
            status = `HTTP error: ${e.code}`;
        } else {
            status = `Exception: ${e}`;
            console.error(e.stack || e);
        }
        console.error(`[${item.name}] ${status}`);
    }

    curStatus.text = status;
    curStatus.date = new Date();
    let curType: StatusType;
    if (result) {
        curType = 'instock';
    } else if (errored) {
        curType = 'error';
    } else {
        curType = 'outofstock';
    }
    
    if (curStatus.type !== curType) {
        typeToDateRange(curStatus).end = curStatus.date;
        
        curStatus.type = curType;
        const useDateRange = typeToDateRange(curStatus);
        useDateRange.start = curStatus.date;
        useDateRange.end = undefined;
    }

    LAST_STATUS_MAP[item.name] = curStatus;
    
    writeStatus();

    return result;
}

interface MatcherBaseConfig {
    type: string;
    name: string;
    sku: string;
    enabled: boolean;
}
interface MatcherWithDescConfig extends MatcherBaseConfig {
    desc: string;
}
type MatcherFunc = (config: MatcherBaseConfig) => Item;
const MATCHER_TYPES: { [key: string]: MatcherFunc } = {};

const BESTBUY_ZIP = 98052;
const BESTBUY_STORE = 498;
MATCHER_TYPES.bestbuy = (cfg: MatcherBaseConfig) => {
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
};

MATCHER_TYPES.newegg = (cfg: MatcherBaseConfig) => {
    return {
        name: cfg.name,
        url: `https://www.newegg.com/product/api/ProductRealtime?ItemNumber=${cfg.sku}`,
        browserUrl: `https://www.newegg.com/${(cfg as MatcherWithDescConfig).desc}/p/${cfg.sku}?Item=${cfg.sku}`,
        dataType: 'json',
        matcher: 'object',
        path: 'MainItem.Instock',
        value: true,
        notifyOnResult: true,
        needH2: false,
        needProxy: true,
        //randomQueryParam: 'r',
    };
};

MATCHER_TYPES.newegg_search = (cfg: MatcherBaseConfig) => {
    return {
        name: cfg.name,
        url: `https://www.newegg.com/p/pl?d=${cfg.sku}`,
        dataType: 'text',
        matcher: 'text_contains',
        path: '',
        value: 'Add to cart',
        notifyOnResult: true,
        needH2: false,
        needProxy: true,
        //randomQueryParam: 'r',
    };
};

MATCHER_TYPES.amd = (cfg: MatcherBaseConfig) => {
    return {
        name: cfg.name,
        url: `https://www.amd.com/en/direct-buy/${cfg.sku}/us`,
        dataType: 'text',
        matcher: 'text_contains',
        path: '',
        value: 'href="/en/direct-buy/add-to-cart/',
        notifyOnResult: true,
        needH2: true,
        needProxy: false,
        //randomQueryParam: 'r',
    };
};

MATCHER_TYPES.amazon = (cfg: MatcherBaseConfig) => {
    return {
        name: cfg.name,
        url: `https://www.amazon.com/dp/${cfg.sku}`,
        dataType: 'text',
        matcher: 'text_contains',
        path: '',
        value: 'id="addToCart_feature_div"',
        errorValue: '/errors/validateCaptcha',
        notifyOnResult: true,
        needH2: false,
        needProxy: true,
    };
};

MATCHER_TYPES.steam = (cfg: MatcherBaseConfig) => {
    return {
        name: cfg.name,
        url: `https://store.steampowered.com/app/${cfg.sku}/${(cfg as MatcherWithDescConfig).desc}/`,
        dataType: 'text',
        matcher: 'text_contains',
        path: '',
        value: `id="btn_add_to_cart_`,
        notifyOnResult: true,
        needH2: false,
        needProxy: false,
    };
};

const minSleep = parseInt(process.env.PAGE_SLEEP_MIN!, 10);
const maxSleep = parseInt(process.env.PAGE_SLEEP_MAX!, 10);
const minSleepTest = parseInt(process.env.TEST_SLEEP_MIN!, 10);
const maxSleepTest = parseInt(process.env.TEST_SLEEP_MAX!, 10);
function getSleepTime(min: number, max: number) {
    return min + (Math.random() * (max - min));
}

async function testLoop(item: Item) {
    if (await tryCheckItem(item, false)) {
        console.log(`[${item.name}] TEST OK!`);
    }
    setTimeout(testLoop, getSleepTime(minSleepTest, maxSleepTest), item);
}

async function itemLoop(item: Item) {
    await tryCheckItem(item, true);
    setTimeout(itemLoop, getSleepTime(minSleep, maxSleep), item);
}

function loadMatchers(file: string) {
    const data = JSON.parse(readFileSync(file, 'utf8')) as MatcherBaseConfig[];
    const matchers: Item[] = [];
    for (const d of data) {
        if (!d.enabled) {
            continue;
        }
        const m = MATCHER_TYPES[d.type];
        if (!m) {
            console.error(`Unknown matcher type ${d.type}. Ignoring.`);
            continue;
        }
        const i = m(d);
        if (ITEMS_MAP[i.name]) {
            console.error(`Duplicate item name ${i.name}. Ignoring.`);
            continue;
        }
        ITEMS_MAP[i.name] = i;
        matchers.push(i);
    }
    return matchers;
}

async function main() {
    const tests = loadMatchers('testmatchers.json');
    const matchers = loadMatchers('matchers.json');

    tests.forEach(t => { t.testmode = true });
    matchers.forEach(m => { m.testmode = false });

    await Promise.all(tests.map(t => testLoop(t)));
    await Promise.all(matchers.map(m => itemLoop(m)));
}

main()
    .then(() => {
        console.log('INIT DONE');
        FULLY_INITED = true;
    })
    .catch((e) => {
        console.error(e.stack || e);
        process.exit(1);
    });
