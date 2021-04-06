FROM node:14

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY bot/ .
COPY .env .

EXPOSE 8080
CMD [ "forever", "start", "bot.js" ]
