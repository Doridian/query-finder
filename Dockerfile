FROM node:lts-alpine

COPY src/ /opt/app/src
COPY items /opt/app/items
COPY tsconfig.json /opt/app/tsconfig.json
COPY package.json /opt/app/package.json
COPY package-lock.json /opt/app/package-lock.json
WORKDIR /opt/app

RUN npm ci && npm run build
RUN chown nobody:nobody /opt/app

VOLUME /opt/app/.env

EXPOSE 8988

USER nobody
ENTRYPOINT ["node", "build/index.js"]
