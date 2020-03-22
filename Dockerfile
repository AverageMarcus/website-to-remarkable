FROM node:10-alpine

RUN apk add --no-cache chromium nss freetype freetype-dev harfbuzz ca-certificates ttf-freefont

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true
ENV CHROMIUM_PATH "/usr/bin/chromium-browser"

WORKDIR /app

ADD package.json .
RUN npm install

ADD . .

CMD npm start
