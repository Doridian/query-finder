require('dotenv').config();

import { SocksProxyAgent } from 'socks-proxy-agent';
import { RequestOptions, request as h1request, Agent } from 'https';
import { ServerResponse } from 'http';
import { parse } from 'url';
import { JSDOM } from 'jsdom';
import { inflate, brotliDecompress, gunzip } from 'zlib';
import { promisify } from 'util';
import { writeFile } from 'fs';
const { request: h2request } = require('http2-client');
const TG = require('telegram-bot-api');

const inflateAsync = promisify(inflate);
const brotliDecompressAsync = promisify(brotliDecompress);
const gunzipAsync = promisify(gunzip);

class HttpError extends Error {
    constructor(code: number, public body: string) {
        super(`HTTP Code: ${code}`);
    }
}

class ElementNotFoundError extends Error { }

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
    return matcher(data, item.path, item.value);
}

const tgChatId = process.env.TELEGRAM_CHAT_ID;
const tgApi = new TG({
    token: process.env.TELEGRAM_ACCESS_TOKEN,
});

async function tryCheckItem(item: Item, allowNotify: boolean) {
    try {
        const matches = await checkItem(item);
        if (matches === item.notifyOnResult) {
            console.log(`[${item.name}] FOUND!`);
            if (allowNotify) {
                console.log(`[${item.name}] PING!`);
                const notifyText = `FOUND: ${item.name} at ${item.browserUrl || item.url}`;
                await tgApi.sendMessage({
                    chat_id: tgChatId,
                    disable_web_page_preview: 'true',
                    text: notifyText,
                });
            }
            return true;
        } else {
            console.log(`[${item.name}] NOT FOUND!`);
        }
    } catch(e) {
        console.error(`[${item.name}] ERROR: ${e.stack || e.message || JSON.stringify(e)}`);
    }
    return false;
}

function makeBestBuyMatcher(name: string, desc: string, itemNumber: string): Item {
    const zipCode = 98052;
    const storeId = 498;
    return {
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
    };
}

function makeNewEggMatcher(name: string, desc: string, itemNumber: string): Item {
    return {
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
    };
}

function makeAMDMatcher(name: string, itemNumber: string): Item {
    return {
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
    };
}

function makeAmazonMatcher(name: string, desc: string, itemNumber: string): Item {
    return {
        name,
        url: `https://www.amazon.com/${desc}/dp/${itemNumber}`,
        dataType: 'text',
        matcher: 'text_contains',
        path: '',
        value: 'id="addToCart_feature_div"',
        notifyOnResult: true,
        needH2: false,
        needProxy: true,
    };
}

function makeSteamWatcher(name: string, desc: string, itemNumber: string): Item {
    return {
        name,
        url: `https://store.steampowered.com/app/${itemNumber}/${desc}/`,
        dataType: 'text',
        matcher: 'text_contains',
        path: '',
        value: `id="btn_add_to_cart_`,
        notifyOnResult: true,
        needH2: false,
        needProxy: false,
    }
}

const BEST_BUY_5950X = '6438941';
const BEST_BUY_5950X_DESC = 'amd-ryzen-9-5950x-4th-gen-16-core-32-threads-unlocked-desktop-processor-without-cooler';
const BEST_BUY_TEST = '6247254';

const NEWEGG_5950X = 'N82E16819113663';
const NEWEGG_5950X_DESC = 'amd-ryzen-9-5950x';
const NEWEGG_TEST = 'N82E16824569006';

const AMD_5950X = '5450881400';
const AMD_TEST = '5335621300';

const AMAZON_5950X = 'B0815Y8J9N';
const AMAZON_5950X_DESC = 'abcdefg';
const AMAZON_TEST = 'B07D998212';

const STEAM_INDEX_BASE_STATION = '1059570';
const STEAM_INDEX_BASE_STATION_DESC = 'Valve_Index_Base_Station';
const STEAM_TEST = '1072820';
const STEAM_TEST_DESC = 'Face_Gasket_for_Valve_Index_Headset__2_Pack';


async function testItem(item: Item) {
    if (!await tryCheckItem(item, false)) {
        throw new Error('Test item NOT FOUND!');
    }
}

const minSleep = parseInt(process.env.PAGE_SLEEP_MIN!, 10);
const maxSleep = parseInt(process.env.PAGE_SLEEP_MAX!, 10);
function getSleepTime() {
    return minSleep + (Math.random() * (maxSleep - minSleep));
}

async function itemLoop(item: Item) {
    await tryCheckItem(item, true);
    setTimeout(itemLoop, getSleepTime(), item);
}

async function main() {
    await testItem(makeBestBuyMatcher('BestBuy Test', 'X', BEST_BUY_TEST));
    await testItem(makeNewEggMatcher('NewEgg Test', 'X', NEWEGG_TEST));
    await testItem(makeAMDMatcher('AMD Test', AMD_TEST));
    await testItem(makeSteamWatcher('Steam Test', STEAM_TEST_DESC, STEAM_TEST));
    //await testItem(makeAmazonMatcher('Amazon Test', 'X', AMAZON_TEST));

    itemLoop(makeBestBuyMatcher('BestBuy 5950x', BEST_BUY_5950X_DESC, BEST_BUY_5950X));
    itemLoop(makeNewEggMatcher('NewEgg 5950x', NEWEGG_5950X_DESC, NEWEGG_5950X));
    itemLoop(makeAMDMatcher('AMD 5950x', AMD_5950X));
    itemLoop(makeSteamWatcher('Steam Index Base Station', STEAM_INDEX_BASE_STATION_DESC, STEAM_INDEX_BASE_STATION));
    //itemLoop(makeAmazonMatcher('Amazon 5950x', AMAZON_5950X_DESC, AMAZON_5950X));
}

main()
    .then(() => console.log('DONE'))
    .catch((e) => {
        console.error(e.stack || e);
        process.exit(1);
    });
