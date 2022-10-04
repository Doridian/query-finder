FROM node:lts-alpine

COPY . /opt/app
WORKDIR /opt/app

RUN apk add --no-cache ca-certificates && \
        mkdir -p /config && \
        ln -sf /config/.env ./.env && \
        chown nobody:nobody /config && \
        npm ci && \
        npm run build && \
        chown root:root .

ENV STATUS_JSON=/config/status.json
ENV LAST_DIR=/config/last
EXPOSE 8988
VOLUME /config

USER nobody
ENTRYPOINT ["node", "build/index.js"]
