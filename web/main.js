'use strict';

const RENDER_INTERVAL = 500;
const FETCH_PAUSE = 1000;

let ITEMS_MAP = {};
let STATUS_MAP = {};
let FETCH_DATE = undefined;
let RENDER_DATE = undefined;

function dateReviver(_key , value) {
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{1,3}Z$/.test(value)) {
        return new Date(value);
    }

    return value;
}

function makeTextSpan(txt, className) {
    const res = document.createElement('span');
    if (className) {
        res.className = className;
    }
    res.appendChild(makeText(txt));
    return res;
}

function makeText(txt) {
    return document.createTextNode(txt);
}

function makeElementWithChild(tag, child) {
    const res = document.createElement(tag);
    res.appendChild(child);
    return res;
}

const ONE_MINUTE = 60;
const ONE_HOUR = 60 * ONE_MINUTE;
const ONE_DAY = 24 * ONE_HOUR;
const MAX_TIME_AGO = 30 * ONE_DAY;
function formatDateRange(dateRange, now) {
    if (!dateRange || !dateRange.start) {
        return makeTextSpan('-');
    }

    if (!dateRange.end) {
        return formatDateDiff(dateRange.start, now, undefined, 'Since ');
    }

    const node = document.createElement('span');
    node.appendChild(formatDateDiff(dateRange.start, now));
    node.appendChild(makeText(' - '));
    node.appendChild(formatDateDiff(dateRange.end, now));
    node.appendChild(makeText(' ('));
    node.appendChild(formatDateDiff(dateRange.start, dateRange.end, ''));
    node.appendChild(makeText(')'));
    return node;
}

function formatDateDiff(date, relativeTo, suffix = ' ago', prefix = '') {
    let diff = Math.floor((relativeTo.getTime() - date.getTime()) / 1000);
    if (diff < 0) {
        diff = 0;
    }
    if (diff > MAX_TIME_AGO) {
        return makeTextSpan(date.toISOString());
    }

    let strArray = [];
    let diffOrders = 0;
    if (diff >= ONE_DAY) {
        strArray.push(`${Math.floor(diff / ONE_DAY)}d`);
        diff %= ONE_DAY;
        if (diffOrders < 3) {
            diffOrders = 3;
        }
    }
    if (diff >= ONE_HOUR) {
        strArray.push(`${Math.floor(diff / ONE_HOUR)}h`);
        diff %= ONE_HOUR;
        if (diffOrders < 2) {
            diffOrders = 2;
        }
    }
    if (diff >= ONE_MINUTE) {
        strArray.push(`${Math.floor(diff / ONE_MINUTE)}m`);
        diff %= ONE_MINUTE;
        if (diffOrders < 1) {
            diffOrders = 1;
        }
    }
    strArray.push(`${diff}s`);

    return makeTextSpan(`${prefix}${strArray.join(' ')}${suffix}`, `diff-${diffOrders}`);
}

function generateTable(filter, replace) {
    const parent = document.createElement(replace.tagName);
    parent.id = replace.id;

    for (const k of Object.keys(STATUS_MAP)) {
        const v = STATUS_MAP[k];
        const i = ITEMS_MAP[k];
        if (!i || !filter(i, v)) {
            continue;
        }

        const tr = document.createElement('tr');
        
        const tdName = document.createElement('td');
        tdName.scope = 'row';
        const aName = document.createElement('a');
        aName.href = i.browserUrl || i.url;
        aName.target = '_blank';
        aName.appendChild(document.createTextNode(k));
        tdName.appendChild(aName);
        tr.appendChild(tdName);
        
        let statusText;
        switch (v.type) {
            case 'error':
                statusText = v.lastError;
                break;
            case 'instock':
                statusText = 'In stock';
                break;
            case 'outofstock':
                statusText = 'Out of stock';
                break;
        }
        const tdStatus = makeElementWithChild('td', document.createTextNode(statusText));
        tdStatus.className = `status-${v.type}`;
        tr.appendChild(tdStatus);

        tr.appendChild(makeElementWithChild('td', formatDateDiff(v.date, RENDER_DATE)));
        tr.appendChild(makeElementWithChild('td', formatDateRange(v.dateLastOutOfStock, RENDER_DATE)));
        tr.appendChild(makeElementWithChild('td', formatDateRange(v.dateLastStock, RENDER_DATE)));
        tr.appendChild(makeElementWithChild('td', formatDateRange(v.dateLastError, RENDER_DATE)));

        parent.appendChild(tr);
    }

    replace.parentNode.replaceChild(parent, replace);
}

function renderTables() {
    if (!FETCH_DATE || !ITEMS_MAP || !STATUS_MAP) {
        return;
    }
    RENDER_DATE = new Date();

    generateTable(i => i.testmode, document.getElementById('tableTests'));
    generateTable(i => !i.testmode, document.getElementById('tableTtems'));

    document.getElementById('gendate').innerText = RENDER_DATE.toISOString();
    document.getElementById('fetchdate').innerText = FETCH_DATE.toISOString();
}

function renderTablesDebounced() {
    const now = new Date();
    if (now - RENDER_DATE < RENDER_INTERVAL) {
        return;
    }
    renderTables();
}

async function loadStatus() {
    const res = await fetch('/status');
    const text = await res.text();
    const data = JSON.parse(text, dateReviver);

    FETCH_DATE = data.date;
    STATUS_MAP = data.status;

    renderTables();
}

async function loadItems() {
    const res = await fetch('/items');
    const text = await res.text();
    const data = JSON.parse(text, dateReviver);

    ITEMS_MAP = data.items;

    renderTables();

    return data.inited;
}

function tryloadItems() {
    let inited = false;
    loadItems()
        .then((res) => { inited = res; })
        .catch((e) => console.error(e))
        .then(() => {
            if (!inited) {
                setTimeout(tryloadItems, FETCH_PAUSE);
            }
        });
}

function tryLoadStatus() {
    loadStatus()
        .catch((e) => console.error(e))
        .then(() => setTimeout(tryLoadStatus, FETCH_PAUSE));
}

function main() {
    tryloadItems();
    tryLoadStatus();
    setInterval(renderTablesDebounced, RENDER_INTERVAL);
}
