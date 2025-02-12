import { Item } from './types.js';
import { config } from './config.js';
import fetch from 'node-fetch';
import { promisify } from 'util';
import { readFile } from 'fs';

const readFileAsync = promisify(readFile);

let PROXIES: string[] = [];
let currentProxyIndices: { [key: string]: number } = {};

// This understands proxies in the following formats (decreasing order of preference):
// 1. PROTOCOL://[USER:PASSWORD]@IP[:PORT]
// 2. IP:PORT:USER:PASSWORD
// 3. IP:PORT

const proxyRefreshInterval = parseInt(config.PROXY_REFRESH_INTERVAL!, 10);

function proxyTypeFromPort(port: string) {
    const portNumber = parseInt(port, 10);
    switch (portNumber) {
        case 80:
        case 8080:
            return 'http';
        case 443:
        case 8443:
            return 'https';
        case 1080:
            return 'socks5';
    }

    return 'socks5';
}

function tryAddProxy(line: string, newProxies: string[]) {
    if (!line) {
        return;
    }
    const lineTrim = line.trim();
    if (!lineTrim) {
        return;
    }

    if (lineTrim.includes('://')) {
        newProxies.push(lineTrim);
        return;
    }

    const l = lineTrim.split(':');
    switch (l.length) {
        case 4:
            // IP:PORT:USER:PW
            newProxies.push(`${proxyTypeFromPort(l[1])}://${l[2]}:${l[3]}@${l[0]}:${l[1]}`);
            break;
        case 2:
            // IP:PORT
            newProxies.push(`${proxyTypeFromPort(l[1])}://${l[0]}:${l[1]}`);
            break;
    }
}

function tryAddProxyLines(data: string, newProxies: string[]) {
    for (const line of data.split('\n')) {
        tryAddProxy(line, newProxies);
    }
}

async function refreshProxiesURL(url: string, newProxies: string[]) {
    const res = await fetch(url);
    tryAddProxyLines(await res.text(), newProxies);
}

async function refreshProxiesFile(file: string, newProxies: string[]) {
    tryAddProxyLines(await readFileAsync(file, 'utf8'), newProxies);
}

async function refreshProxies() {
    const newProxies: string[] = [];

    if (config.PROXY_URL) {
        await refreshProxiesURL(config.PROXY_URL, newProxies);
    }

    if (config.PROXY_FILE) {
        await refreshProxiesFile(config.PROXY_FILE, newProxies);
    }

    if (config.PROXY) {
        tryAddProxy(config.PROXY, newProxies);
    }

    if (PROXIES.length !== newProxies.length) {
        currentProxyIndices = {};
    }
    PROXIES = newProxies;
    console.log(`Loaded proxy list: Got ${PROXIES.length}`);
}

function getProxyIndex(item: Item) {
    const key = item.storeName;
    let idx = currentProxyIndices[key];
    if (idx === undefined) {
        currentProxyIndices[key] = 0;
        return 0;
    }
    idx++;
    if (idx >= PROXIES.length) {
        idx = 0;
    }
    currentProxyIndices[key] = idx;
    return idx;
}

export function getProxy(item: Item) {
    return PROXIES[getProxyIndex(item)];
}

export async function refreshProxyLoop(): Promise<boolean> {
    try {
        await refreshProxies();
    } catch (error) {
        console.error('Error refreshing proxies:', error);
        return false;
    } finally {
        setTimeout(refreshProxyLoop, proxyRefreshInterval);
    }
    return true;
}
