import { createReadStream } from 'fs';
import { createServer, ServerResponse } from 'http';
import { join, normalize } from 'path';
import { ITEMS_MAP, LAST_STATUS_MAP } from './globals';

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
	path: string,
	relativeTo: string = webroot
) {
	path = normalize(`./${path}`);

	const fsPath = join(relativeTo, path);
	try {
        const stream = createReadStream(fsPath);
        
        let responseDead = false;
		stream.on('error', (error) => {
            responseDead = true;
			sendError(response, error.message);
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
		sendError(response, (error as Error).message);
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
    
        switch (url) {
            case '/data':
                sendJSON(response, {
                    date: new Date(),
                    items: ITEMS_MAP,
                    status: LAST_STATUS_MAP,
                });
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
