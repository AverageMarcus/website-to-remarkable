FROM node:10-alpine

RUN apk add chromium nss freetype freetype-dev harfbuzz ca-certificates ttf-freefont

WORKDIR /app

ADD package.json .
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true
ENV CHROMIUM_PATH "/usr/bin/chromium-browser"
RUN npm install

ADD . .

CMD npm start
