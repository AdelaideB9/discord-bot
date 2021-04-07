
## Installation

### Prerequisites

Create a `.env` file in the root directory and paste your bot token inside with the variable name `TOKEN`. 

```
TOKEN=XXXXXXXXXXX.XXXX.XXXXXXX
```

### Node.js
`npm install`
`npm start`


### Docker
`docker build -t adelaideb9/discord-bot .`
`docker run -p 1234:8080 -d adelaideb9/discord-bot`


## Acknowledgements
* [discord.js](https://github.com/discordjs/discord.js)