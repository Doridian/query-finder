import fetch from 'node-fetch';
import { readFile } from 'fs';
import { promisify } from 'util';

const readFileAsync = promisify(readFile);

let PROXIES: string[] = [];
let currentProxyIndex = 0;

// This understands proxies in the following formats (decreasing order of preference):
// 1. PROTOCOL://[USER:PASSWORD]@IP[:PORT]
// 2. IP:PORT:USER:PASSWORD
// 3. IP:PORT

const proxyRefreshInterval = parseInt(process.env.PROXY_REFRESH_INTERVAL!, 10);

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
    const res = await fetch(url, {
        timeout: 5000,
    });
    tryAddProxyLines(await res.text(), newProxies);
}

async function refreshProxiesFile(file: string, newProxies: string[]) {
    tryAddProxyLines(await readFileAsync(file, 'utf8'), newProxies);
}

async function refreshProxies() {
    const newProxies: string[] = [];

    if (process.env.PROXY_URL) {
        await refreshProxiesURL(process.env.PROXY_URL, newProxies);
    }

    if (process.env.PROXY_FILE) {
        await refreshProxiesFile(process.env.PROXY_FILE, newProxies);
    }

    if (process.env.PROXY) {
        tryAddProxy(process.env.PROXY, newProxies);
    }

    if (PROXIES.length !== newProxies.length) {
        currentProxyIndex = 0;
    }
    PROXIES = newProxies;
    console.log(`Loaded proxy list: Got ${PROXIES.length}`);
}

export function getProxy() {
    currentProxyIndex++;
    if (currentProxyIndex >= PROXIES.length) {
        currentProxyIndex = 0;
    }
    return PROXIES[currentProxyIndex];
}

export async function refreshProxyLoop() {
    try {
        await refreshProxies();
    } finally {
        setTimeout(refreshProxyLoop, proxyRefreshInterval);
    }
}
