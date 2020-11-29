import { parse } from 'url';
import { notifyRaw } from '../notifiers';
import { fetchCustom } from '../http';
import { readFileSync, writeFile } from 'fs';

function loadLinkCache() {
    let _obj: { [key: string]: string } = {};
    try {
        _obj = JSON.parse(readFileSync('./last/_link_cache.json', 'utf8'));
    } catch (e) {
        console.error(e);
    }
    return _obj;
}

function writeLinkCache() {
    writeFile('./last/_link_cache.json', JSON.stringify(LINK_CACHE), (e) => {
        if (e) {
            console.error('Error writing link cache', e);
        }
    });
}

const TRIGGER_TERMS = ['5950'];
const LINK_CACHE: { [key: string]: string } = loadLinkCache();
const TITLE_REGEX = /<title>([^<>]+)<\/title>/i;

export abstract class LiveChatBase {
    public abstract attachChat(): void | Promise<void>;

    protected abstract findChatInternal(): boolean | Promise<boolean>;

    public name: string;

    public constructor(config: any) {
        this.name = config.name;
    }

    public async findChat() {
        const res = await this.findChatInternal();
        if (res) {
            await this.attachChat();
        }
    }

    protected async submitMessage(message: string | null | undefined) {
        if (!message) {
            return;
        }
        message = message.trim();
        if (message.length < 1) {
            return;
        }

        try {
            await this.processMessage(message);
        } catch (e) {
            console.error('Error processing message', message, e);
        }
    }

    private isTextInteresting(text: string) {
        const textLower = text.toLowerCase();

        // Check if we have any trigger terms
        for (const term of TRIGGER_TERMS) {
            if (textLower.includes(term)) {
                return true;
            }
        }

        return false;
    }

    private async processMessage(message: string) {
        console.log(`[CHAT] <${this.name}> ${message}`);
        let messageInteresting = this.isTextInteresting(message);

        // Check if we have any links
        const split = message.split(' ');
        for (const term of split) {
            const termTrim = term.trim();
            if (!termTrim) {
                continue;
            }
            const termLower = termTrim.toLowerCase();
            if (!termLower.startsWith('http://') && !termLower.startsWith('https://')) {
                continue;
            }
            await this.checkLink(term);
        }

        if (messageInteresting) {
            await notifyRaw(`Message via ${this.name}: ${message}`);
        }
    }

    protected async checkLink(link: string) {
        const title = await this.processLink(link);
        if (!title) {
            return;
        }

        if (this.isTextInteresting(title)) {
            await notifyRaw(`Link via ${this.name}: ${link}`);
        }
    }

    private async processLink(link: string, depth: number = 0): Promise<string | undefined> {
        if (LINK_CACHE[link]) {
            return LINK_CACHE[link];
        }

        console.log(`[LINK] Resolving: ${link}`);
        if (depth > 5) {
            console.warn(`[LINK] Exceeded depth on: ${link}`);
            return;
        }

        let url;
        try {
            url = parse(link);
        } catch (e) {
            return;
        }
        if (!url) {
            return;
        }
        const res = await fetchCustom({
            url: link,
            needH2: true,
            needProxy: false,
        });

        let title: string | undefined = undefined;
        if (res.status >= 300 && res.status <= 399) {
            title = await this.processLink(res.headers.location || res.headers.Location, depth + 1);
        } else if (res.status < 200 || res.status > 299) {
            console.warn(`[LINK] Got status code ${res.status} on: ${link}`)
            return;
        } else {
            const text = await res.text();
            const m = TITLE_REGEX.exec(text);
            if (!m) {
                title = text;
            } else {
                title = m[1];
            }
        }

        console.log(`[LINK] Resolved ${link} to ${title}`);

        if (!title) {
            return;
        }

        LINK_CACHE[link] = title;
        writeLinkCache();

        return title;
    }
}