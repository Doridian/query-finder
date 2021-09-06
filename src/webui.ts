import { ITEMS_MAP, LAST_STATUS_MAP, isFullyInited, writeStatus } from './globals';
import { ServerResponse, createServer } from 'http';
import { isAbsolute, join, normalize, relative } from 'path';

import { createReadStream } from 'fs';

const approot = join(__dirname, '../');
const webroot = join(approot, './web');

const contentTypeMap: Record<string, string> = {
	css: 'text/css',
	htm: 'text/html',
	html: 'text/html',
	jpeg: 'image/jpeg',
	jpg: 'image/jpeg',
	js: 'application/javascript',
	json: 'application/json',
	png: 'image/png',
	txt: 'text/plain'
};

function sendFile(
	response: ServerResponse,
	path: string
) {
	path = normalize(`./${path}`);

    const fsPath = join(webroot, path);

    const relPath = relative(webroot, fsPath);
    if (!relPath || relPath.startsWith('..') || isAbsolute(relPath)) {
        sendError(response, 'Bad request', 400);
        return;
    }

	try {
        const stream = createReadStream(fsPath);
        
        let responseDead = false;
		stream.on('error', () => {
            responseDead = true;
            sendError(response, 'Not found', 404);
		});

		const pathSplit = path.split('.');
        const ext = pathSplit[pathSplit.length - 1].toLowerCase();
        
        if (responseDead) {
            return;
        }

		response.setHeader(
			'Content-Type',
			contentTypeMap[ext] ?? contentTypeMap.txt
		);

		stream.on('end', () => response.end());
		stream.pipe(response);
	} catch (error: unknown) {
		console.error(`Error in WebUI ${error}`);
		sendError(response, 'Internal server error');
	}
}

function sendError(response: ServerResponse, data: string, statusCode = 500) {
	response.statusCode = statusCode;
	response.setHeader('Content-Type', contentTypeMap.txt);
	response.write(data);
	response.end();
}

function sendJSON(response: ServerResponse, data: any) {
	response.setHeader('Content-Type', contentTypeMap.json);
	response.write(JSON.stringify(data));
	response.end();
}

export function startWebUI() {
    const srv = createServer((request, response) => {
        const url = request.url!;
        const method = request.method!.toUpperCase();
    
        switch (url) {
            case '/status':
                sendJSON(response, {
                    date: new Date(),
                    status: LAST_STATUS_MAP,
                });
                break;
            case '/items':
                sendJSON(response, {
                    date: new Date(),
                    inited: isFullyInited(),
                    items: ITEMS_MAP,
                });
                break;
            case '/reseterror':
                if (method !== 'POST') {
                    sendError(response, 'Wrong method', 400);
                    break;
                }
                for (const k of Object.keys(LAST_STATUS_MAP)) {
                    const v = LAST_STATUS_MAP[k];
                    delete v.dateLastError;
                }
                writeStatus();
                sendJSON(response, { ok: true });
                break;
            case '/favicon.ico':
                sendError(response, '', 404);
                break;
            case '/':
                sendFile(response, '/index.htm');
                break;
            default:
                sendFile(response, url);
                break;
        }
    });
    srv.listen(process.env.PORT);
}
