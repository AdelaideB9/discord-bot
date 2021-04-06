
require('dotenv').config();

const Discord = require('discord.js');
const client = new Discord.Client();

const { prefix, adminRole } = require('./config.json');

client.on('ready', () => {
	console.log(`Logged in as ${client.user.tag}!`);

	client.user.setPresence({ activity: { name: "I don't work pls help meowwwww", type: "COMPETING" } })
		.then(console.log)
		.catch(console.error);
});

client.on('message', msg => {
	if (msg.content === 'ping') {
		msg.reply('pong');
	}
});

client.login(process.env.TOKEN)
