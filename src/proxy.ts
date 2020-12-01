import fetch from 'node-fetch';

let PROXIES: string[] = [];
let currentProxyIndex = 0;

const proxyRefreshInterval = parseInt(process.env.PROXY_REFRESH_INTERVAL!, 10);

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
        const [ip,port,username,password] = line.trim().split(':');
        if (!ip || !port || !username || !password) {
            continue;
        }
        newProxies.push(`socks5://${username}:${password}@${ip}:${port}`);
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
