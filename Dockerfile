FROM node:lts-alpine

COPY src/ /opt/app/src
COPY tsconfig.json /opt/app/tsconfig.json
COPY package.json /opt/app/package.json
COPY package-lock.json /opt/app/package-lock.json
WORKDIR /opt/app

RUN npm ci && npm run build

VOLUME /opt/app/.env

EXPOSE 8988

USER nobody
ENTRYPOINT ["node", "build/index.js"]