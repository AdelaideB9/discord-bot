
require('dotenv').config();

const Discord = require('discord.js');
const client = new Discord.Client();
const fs = require('fs');
const shell = require('shelljs'); // interact with the OS's shell

// Loading data
let data = JSON.parse(fs.readFileSync('data.json'));
const { prefix, adminRole } = require('./config.json');

client.on('ready', () => {
	console.log(`Logged in as ${client.user.tag}!`);
	client.channels.cache.get(data.restartChannel).send('Hi again! I just restarted.');

	client.user.setPresence({ activity: { name: "I don't work pls help meowwwww", type: "COMPETING" } })
		.then(console.log)
		.catch(console.error);
});

client.on('message', message => {
	if (message.content === 'ping') {
		message.reply('pong');
	}
	else if (message.content === `${prefix}update` || message.content === `${prefix}restart`) {
		console.log(message.member.roles)
		if (message.member.roles.cache.find(r => r.name === adminRole)) {
			message.channel.send('Restarting and checking for updates...');
			data.restartChannel = message.channel.id;
			fs.writeFileSync('data.json', JSON.stringify(data, null, 4));
			setTimeout(() => {
				shell.exec('./update.sh');
				message.channel.send('Failed to restart!');
			}, 1000);
		}
		else {
			message.reply("you need to be an admin for that...")
		}
	} 
});

client.login(process.env.TOKEN)
