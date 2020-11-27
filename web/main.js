let ITEMS_MAP = {};

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
    if (diff > MAX_TIME_AGO) {
        return makeTextSpan(date.toISOString());
    }

    let strArray = [];
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

    return makeTextSpan(`${prefix}${strArray.join(' ')}${suffix}`, `diff-${diffOrders}`);
}

function generateTable(data, filter, replace) {
    const now = data.date;
    const parent = document.createElement(replace.tagName);
    parent.id = replace.id;

    for (const k of Object.keys(data.status)) {
        const v = data.status[k];
        const i = ITEMS_MAP[k];
        if (!i || !filter(i, v)) {
            continue;
        }

        const tr = document.createElement('tr');
        
        const tdName = document.createElement('td');
        tdName.scope = 'row';
        const aName = document.createElement('a');
        aName.href = i.browserUrl || i.url;
        aName.appendChild(document.createTextNode(k));
        tr.appendChild(tdName);
        
        const tdStatus = makeElementWithChild('td', document.createTextNode(v.text));
        tdStatus.className = `status-${v.type}`;
        tr.appendChild(tdStatus);

        tr.appendChild(makeElementWithChild('td', formatDateDiff(v.date, now)));
        tr.appendChild(makeElementWithChild('td', formatDateRange(v.dateLastOutOfStock, now)));
        tr.appendChild(makeElementWithChild('td', formatDateRange(v.dateLastStock, now)));
        tr.appendChild(makeElementWithChild('td', formatDateRange(v.dateLastError, now)));

        parent.appendChild(tr);
    }

    replace.parentNode.replaceChild(parent, replace);
}

async function loadStatus() {
    const res = await fetch('/status');
    const text = await res.text();
    const data = JSON.parse(text, dateReviver);

    generateTable(data, i => i.testmode, document.getElementById('tableTests'));
    generateTable(data, i => !i.testmode, document.getElementById('tableTtems'));

    document.getElementById('gendate').innerText = data.date.toISOString();
}

async function loadItems() {
    const res = await fetch('/items');
    const text = await res.text();
    const data = JSON.parse(text, dateReviver);

    ITEMS_MAP = data.items;

    return data.inited;
}

function tryloadItems() {
    let inited = false;
    loadItems()
        .then((res) => { inited = res; })
        .catch((e) => console.error(e))
        .then(() => {
            if (!inited) {
                setTimeout(tryloadItems, 1000);
            }
        });
}

function tryLoadStatus() {
    loadStatus()
        .catch((e) => console.error(e))
        .then(() => setTimeout(tryLoadStatus, 1000));
}

function main() {
    tryloadItems();
    tryLoadStatus();
}
