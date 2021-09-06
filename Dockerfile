FROM node:lts-alpine

COPY . /opt/app
WORKDIR /opt/app

RUN npm ci && npm run build
RUN chown nobody:nobody /opt/app

VOLUME /opt/app/.env

EXPOSE 8988

USER nobody
ENTRYPOINT ["node", "build/index.js"]
