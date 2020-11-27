function dateReviver(_key , value) {
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{1,3}Z$/.test(value)) {
        return new Date(value);
    }

    return value;
}

let ITEMS_MAP = {};

const ONE_MINUTE = 60;
const ONE_HOUR = 60 * ONE_MINUTE;
const ONE_DAY = 24 * ONE_HOUR;
const MAX_TIME_AGO = 30 * ONE_DAY;
function formatDateRange(dateRange, now) {
    if (!dateRange || !dateRange.start) {
        return '<span>-</span>';
    }

    if (!dateRange.end) {
        return formatDateDiff(dateRange.start, now, undefined, 'Since ');
    }

    return `${formatDateDiff(dateRange.start, now)} - ${formatDateDiff(dateRange.end, now)} (${formatDateDiff(dateRange.start, dateRange.end, '')})`;
}

function formatDateDiff(date, relativeTo, suffix = ' ago', prefix = '') {
    let diff = Math.floor((relativeTo.getTime() - date.getTime()) / 1000);
    if (diff > MAX_TIME_AGO) {
        return `<span>${date.toISOString()}</span>`;
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

    return `<span class="diff-${diffOrders}">${prefix}${strArray.join(' ')}${suffix}</span>`;
}

function generateTable(data, filter) {
    const htmlArray = [];

    const now = data.date;

    for (const k of Object.keys(data.status)) {
        const v = data.status[k];
        const i = ITEMS_MAP[k];
        if (!i || !filter(i, v)) {
            continue;
        }
        htmlArray.push(`<tr>
    <td scope="row"><a href="${i.browserUrl || i.url}" target="_blank">${k}</a></td>
    <td class="status-${v.type}">${v.text}</td>
    <td>${formatDateDiff(v.date, now)}</td>
    <td>${formatDateRange(v.dateLastOutOfStock, now)}</td>
    <td>${formatDateRange(v.dateLastStock, now)}</td>
    <td>${formatDateRange(v.dateLastError, now)}</td>
</tr>`);
    }

    return htmlArray;
}

async function loadStatus() {
    const res = await fetch('/status');
    const text = await res.text();
    const data = JSON.parse(text, dateReviver);

    const tableTests = generateTable(data, i => i.testmode);
    const tableItems = generateTable(data, i => !i.testmode);

    document.getElementById('tableTests').innerHTML = tableTests.join('');
    document.getElementById('tableTtems').innerHTML = tableItems.join('');
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
