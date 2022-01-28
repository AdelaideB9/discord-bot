FROM node:14

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY bot/ .
COPY .env .

CMD [ "forever", "start", "bot.js" ]
