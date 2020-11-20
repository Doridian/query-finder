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
    notifyOnResult: boolean;
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

    return `${formatDate(dateRange.start)} - ${dateRange.end ? formatDate(dateRange.end) : '<span class="diff-0">Now</span>'}`;
}

function formatDate(date: Date) {
    let diff = Math.floor((Date.now() - date.getTime()) / 1000);
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

    return `<span class="diff-${diffOrders}">${strArray.join(' ')} ago</span>`;
}

const srv = createServer((_req, res) => {
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
        htmlArray.push(`<tr>
    <td scope="row"><a href="${i.browserUrl || i.url}" target="_blank">${k}</a></td>
    <td class="status-${v.type}">${v.text}</td>
    <td>${formatDate(v.date)}</td>
    <td>${formatDateRange(v.dateLastOutOfStock)}</td>
    <td>${formatDateRange(v.dateLastStock)}</td>
    <td>${formatDateRange(v.dateLastError)}</td>
</tr>`);
    }
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
            td.status-ok, .diff-2 {
                color: green;
            }
            td.status-warning, .diff-1 {
                color: orange;
            }
            td.status-error, .diff-0 {
                color: red;
            }
        </style>
    </head>
    <body>
        <div class="container-fluid">
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
                    ${htmlArray.join('')}
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
    if (!curStatus.type) {
        return {};
    }

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

function pti(item: Item) {
    ITEMS_MAP[item.name] = item;
    return item;
}

function makeBestBuyMatcher(name: string, desc: string, itemNumber: string): Item {
    const zipCode = 98052;
    const storeId = 498;
    return pti({
        name,
        url: `https://www.bestbuy.com/api/tcfb/model.json?paths=%5B%5B%22shop%22%2c%22buttonstate%22%2c%22v5%22%2c%22item%22%2c%22skus%22%2c${itemNumber}%2c%22conditions%22%2c%22NONE%22%2c%22destinationZipCode%22%2c${zipCode}%2c%22storeId%22%2c%20${storeId}%2c%22context%22%2c%22cyp%22%2c%22addAll%22%2c%22false%22%5D%5D&method=get`,
        browserUrl: `https://www.bestbuy.com/site/${desc}/${itemNumber}.p?skuId=${itemNumber}`,
        dataType: 'json',
        matcher: 'object',
        path: `jsonGraph.shop.buttonstate.v5.item.skus.${itemNumber}.conditions.NONE.destinationZipCode.${zipCode}.storeId.${storeId}.context.cyp.addAll.false.value.buttonStateResponseInfos.0.buttonState`,
        value: 'SOLD_OUT',
        notifyOnResult: false,
        needH2: true,
        needProxy: false,
        //randomQueryParam: 'r',
    });
}

function makeNewEggMatcher(name: string, desc: string, itemNumber: string): Item {
    return pti({
        name,
        url: `https://www.newegg.com/product/api/ProductRealtime?ItemNumber=${itemNumber}`,
        browserUrl: `https://www.newegg.com/${desc}/p/${itemNumber}?Item=${itemNumber}`,
        dataType: 'json',
        matcher: 'object',
        path: 'MainItem.Instock',
        value: true,
        notifyOnResult: true,
        needH2: false,
        needProxy: true,
        //randomQueryParam: 'r',
    });
}

function makeNewEggSearchMatcher(name: string, itemNumber: string): Item {
    return pti({
        name,
        url: `https://www.newegg.com/p/pl?d=${itemNumber}`,
        dataType: 'text',
        matcher: 'text_contains',
        path: '',
        value: 'Add to cart',
        notifyOnResult: true,
        needH2: false,
        needProxy: true,
        //randomQueryParam: 'r',
    });
}

function makeAMDMatcher(name: string, itemNumber: string): Item {
    return pti({
        name,
        url: `https://www.amd.com/en/direct-buy/${itemNumber}/us`,
        dataType: 'text',
        matcher: 'text_contains',
        path: '',
        value: 'href="/en/direct-buy/add-to-cart/',
        notifyOnResult: true,
        needH2: true,
        needProxy: false,
        //randomQueryParam: 'r',
    });
}

function makeAmazonMatcher(name: string, itemNumber: string): Item {
    return pti({
        name,
        url: `https://www.amazon.com/dp/${itemNumber}`,
        dataType: 'text',
        matcher: 'text_contains',
        path: '',
        value: 'id="addToCart_feature_div"',
        notifyOnResult: true,
        needH2: false,
        needProxy: true,
    });
}

function makeSteamWatcher(name: string, desc: string, itemNumber: string): Item {
    return pti({
        name,
        url: `https://store.steampowered.com/app/${itemNumber}/${desc}/`,
        dataType: 'text',
        matcher: 'text_contains',
        path: '',
        value: `id="btn_add_to_cart_`,
        notifyOnResult: true,
        needH2: false,
        needProxy: false,
    });
}

const BEST_BUY_5950X = '6438941';
const BEST_BUY_5950X_DESC = 'amd-ryzen-9-5950x-4th-gen-16-core-32-threads-unlocked-desktop-processor-without-cooler';
const BEST_BUY_TEST = '6247254';
const BEST_BUY_TEST_DESC = 'insignia-32-class-led-hd-smart-fire-tv-edition-tv';

const NEWEGG_5950X = 'N82E16819113663';
const NEWEGG_5950X_DESC = 'amd-ryzen-9-5950x';
const NEWEGG_TEST = 'N82E16820250109';
const NEWEGG_TEST_DESC = 'western-digital-black-sn750-nvme-500gb';

const NEWEGG_SEARCH_5950X = '5950x';
const NEWEGG_SEARCH_TEST = '3800x';

const AMD_5950X = '5450881400';
const AMD_TEST = '5335621300';

const AMAZON_5950X = 'B0815Y8J9N';
const AMAZON_TEST = 'B07D998212';

const STEAM_INDEX_BASE_STATION = '1059570';
const STEAM_INDEX_BASE_STATION_DESC = 'Valve_Index_Base_Station';
const STEAM_TEST = '1072820';
const STEAM_TEST_DESC = 'Face_Gasket_for_Valve_Index_Headset__2_Pack';

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

async function main() {
    await Promise.all([
        testLoop(makeBestBuyMatcher('BestBuy Test', BEST_BUY_TEST_DESC, BEST_BUY_TEST)),
        testLoop(makeNewEggMatcher('NewEgg Test', NEWEGG_TEST_DESC, NEWEGG_TEST)),
        testLoop(makeAMDMatcher('AMD Test', AMD_TEST)),
        testLoop(makeSteamWatcher('Steam Test', STEAM_TEST_DESC, STEAM_TEST)),
        //testLoop(makeNewEggSearchMatcher('NewEgg Search Test', NEWEGG_SEARCH_TEST)),
        //testLoop(makeAmazonMatcher('Amazon Test', AMAZON_TEST),
    ]);

    await Promise.all([
        itemLoop(makeBestBuyMatcher('BestBuy 5950x', BEST_BUY_5950X_DESC, BEST_BUY_5950X)),
        itemLoop(makeNewEggMatcher('NewEgg 5950x', NEWEGG_5950X_DESC, NEWEGG_5950X)),
        itemLoop(makeAMDMatcher('AMD 5950x', AMD_5950X)),
        itemLoop(makeSteamWatcher('Steam Index Base Station', STEAM_INDEX_BASE_STATION_DESC, STEAM_INDEX_BASE_STATION)),
        //itemLoop(makeNewEggSearchMatcher('NewEgg Search 5950x', NEWEGG_SEARCH_5950X)),
        //itemLoop(makeAmazonMatcher('Amazon 5950x', AMAZON_5950X)),
    ]);
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
