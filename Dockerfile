FROM node:lts-alpine

RUN apk update && apk add ca-certificates && rm -rf /var/cache/apk/*

COPY . /opt/app
WORKDIR /opt/app

RUN npm ci && npm run build
RUN chown nobody:nobody /opt/app

VOLUME /opt/app/.env
VOLUME /opt/app/status.json

EXPOSE 8988

USER nobody
ENTRYPOINT ["node", "build/index.js"]
