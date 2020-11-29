import { LiveChatBase } from '.';
import { google, youtube_v3 } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/youtube.readonly'];
const oauth = new google.auth.OAuth2({
    clientId: process.env.YOUTUBE_CLIENT_ID,
    clientSecret: process.env.YOUTUBE_CLIENT_SECRET,
});
oauth.credentials.refresh_token = process.env.YOUTUBE_REFRESH_TOKEN;
oauth.credentials.expiry_date = 0;
oauth.credentials.token_type = 'Bearer';
oauth.credentials.scope = SCOPES.join(',');

export class YouTubeChat extends LiveChatBase {
    private channelId: string;
    private searchString: string | undefined;

    private apiClient: youtube_v3.Youtube;
    private liveChatId: string | undefined;
    private nextPageToken: string | undefined;

    private nextFetchTimeout: NodeJS.Timeout | undefined;

    public constructor(config: any) {
        super(config);
        this.channelId = config.channelId;
        this.searchString = config.searchString;
        this.apiClient = google.youtube({
            version: 'v3',
            auth: oauth,
        });
    }

    protected async findChatInternal() {
        const searchRes = await this.apiClient.search.list({
            part: ['snippet'],
            channelId: this.channelId,
            eventType: 'live',
            type: ['video'],
        });

        let video: youtube_v3.Schema$SearchResult;
        if (this.searchString) {
            video = searchRes.data.items!.filter((i) => i.snippet!.title!.includes(this.searchString!))[0];
        } else {
            video = searchRes.data.items![0];
        }

        const videoRes = await this.apiClient.videos.list({
            part: ['snippet', 'liveStreamingDetails'],
            id: [video.id!.videoId!],
        });

        const newLiveChatId = videoRes.data.items![0].liveStreamingDetails!.activeLiveChatId!;
        if (newLiveChatId !== this.liveChatId) {
            this.liveChatId = newLiveChatId;
            this.nextPageToken = undefined;
            return true;
        }

        return false;
    }

    private async tryFetchChat() {
        try {
            await this.fetchChat();
        } catch (e) {
            console.error('YouTube Error', e);

            this.liveChatId = undefined;
            this.nextPageToken = undefined;

            if (this.nextFetchTimeout !== undefined) {
                clearTimeout(this.nextFetchTimeout);
            }
            this.nextFetchTimeout = setTimeout(async () => {
                this.nextFetchTimeout = undefined;
                await this.findChatInternal();
                await this.tryFetchChat();
            }, 5000);
        }
    }

    private async fetchChat() {
        if (!this.liveChatId) {
            throw new Error('No chat ID');
        }

        const res = await this.apiClient.liveChatMessages.list({
            part: ['snippet'],
            liveChatId: this.liveChatId,
            pageToken: this.nextPageToken,
        });

        this.nextPageToken = res.data.nextPageToken!;

        let pollInterval = res.data.pollingIntervalMillis!;
        if (!pollInterval) {
            pollInterval = 1000;
        }

        if (this.nextFetchTimeout !== undefined) {
            clearTimeout(this.nextFetchTimeout);
        }
        this.nextFetchTimeout = setTimeout(async () => {
            this.nextFetchTimeout = undefined;
            await this.tryFetchChat();
        }, res.data.pollingIntervalMillis!);

        if (res.data.items) {
            for (const msg of res.data.items) {
                const msgSnip = msg.snippet;
                if (!msgSnip || msgSnip.type !== 'textMessageEvent') {
                    continue;
                }
                const msgDetails = msgSnip.textMessageDetails;
                if (!msgDetails) {
                    continue;
                }

                await this.submitMessage(msgDetails.messageText);
            }
        }
    }

    public async attachChat() {
        if (this.nextFetchTimeout !== undefined) {
            return;
        }
        await this.tryFetchChat();
    }
}
