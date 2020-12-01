import fetch from 'node-fetch';

let PROXIES: string[] = [];
let currentProxyIndex = 0;

const proxyRefreshInterval = parseInt(process.env.PROXY_REFRESH_INTERVAL!, 10);
const proxyType = process.env.PROXY_TYPE || 'socks5';

async function refreshProxies() {
    const newProxies: string[] = [];

    const res = await fetch(process.env.PROXY_URL!, {
        timeout: 5000,
    });
    const data = await res.text();
    for (const line of data.split('\n')) {
        if (!line) {
            continue;
        }
        const lineTrim = line.trim();
        if (!lineTrim) {
            continue;
        }
        const l = lineTrim.split(':');
        switch (l.length) {
            case 4:
                // IP:PORT:USER:PW
                newProxies.push(`${proxyType}://${l[2]}:${l[3]}@${l[0]}:${l[1]}`);
                break;
            case 3:
                // IP:USER:PW
                newProxies.push(`${proxyType}://${l[1]}:${l[2]}@${l[0]}`);
                break;
            case 2:
                // IP:PORT
                newProxies.push(`${proxyType}://${l[0]}:${l[1]}`);
                break;
            case 1:
                // IP
                newProxies.push(`${proxyType}://${l[0]}`);
                break;
        }
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
