import { formatDateDiff, formatDateRange } from './date';
import { isFullyInited, ITEMS_MAP, LAST_STATUS_MAP } from './globals';
import { Item, Status } from './types';
import { createServer } from 'http';

function generateTable(filter: (i: Item, v: Status) => boolean) {
    const htmlArray: string[] = [];

    for (const k of Object.keys(LAST_STATUS_MAP)) {
        const v = LAST_STATUS_MAP[k];
        const i = ITEMS_MAP[k];
        if (!i) {
            if (isFullyInited()) {
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
    <td>${formatDateDiff(v.date)}</td>
    <td>${formatDateRange(v.dateLastOutOfStock)}</td>
    <td>${formatDateRange(v.dateLastStock)}</td>
    <td>${formatDateRange(v.dateLastError)}</td>
</tr>`);
    }

    return htmlArray;
}

export function startWebUI() {
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
}
