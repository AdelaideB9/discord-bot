
require('dotenv').config();

const Discord = require('discord.js');
const client = new Discord.Client();
const fs = require('fs');
const shell = require('shelljs'); // interact with the OS's shell
const jwt = require('jsonwebtoken');
const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Loading data
let data = JSON.parse(fs.readFileSync('./data.json'));
let members = JSON.parse(fs.readFileSync('./bot/members.json'));
let messages = JSON.parse(fs.readFileSync('./bot/messages.json'));
let guilds = [];

const { prefix, adminRole, botManagerRole, emailRegex, defaultRole } = require('./config.json');

client.on('ready', () => {
	console.log(`Logged in as ${client.user.tag}!`);

	client.user.setPresence({ activity: { name: "I don't work pls help meowwwww", type: "COMPETING" } })
		.then(console.log)
		.catch(console.error);
	
	// Adding guilds to guilds array
	client.guilds.cache.forEach(guild => {
		guilds.push(guild)
	});
});

// Adding guild to guilds whenever one joins
client.on('guildCreate', guild => {
	guilds.push(guild);
});

client.on('message', message => {

	switch (message.content) {
		case 'ping':
			message.reply('pong');
			break;
		case `${prefix}update`:
			update(message);
			break;
		case `${prefix}restart`:
			update(message);
			break;
	}

	if (message.channel.type == 'dm') {
		switch (message.content.split(' ')[0]) {
			case `${prefix}auth`:
				authenticate(message);
				break;
			case `${prefix}token`:
				recToken(message);
				break;
		}
	}
});

client.on('guildMemberAdd', member => {
	if (!member.roles.cache.some(role => role.name === "member")) {
		sendWelcome(member);
	}
});

client.login(process.env.TOKEN)

function genToken(tag, email) {
	return jwt.sign(
		{
			tag: tag,
		 	email: email
		},
		process.env.TOKEN_SECRET,
		{ expiresIn: 600 }
	);
}

function parse(template, textMap) {
  let output = template

  for (let [id, text] of Object.entries(textMap)) {
    output = output.replace(new RegExp(`\\$\{${id}}`, 'mg'), text)
  }

  return output
}

function sendEmail(token, email) {
	const msg = {
	  	to: email,
		from: 'hello@adelaideb9.com',
	 	subject: 'Discord Authentication',
  		text: parse(messages.authEmail, {token: token})
	};

	(async () => {
		try {
		    await sgMail.send(msg);
		} catch (error) {
		    console.error(error);
		    if (error.response) {
				console.error(error.response.body)
   			}
		}
	})();
}

function authenticate(message) {	
	try {
		// Getting email from input with regex
		let re = new RegExp(emailRegex);
		email = message.content.split(' ')[1].toLowerCase();
		email = re.exec(email)[0];
		
		if (email) {
			// Already authenticated
			if (members.email) {
				message.reply(messages.alreadyAuthenticated);
				return;
			}
			
			// Generate token and send email
			token = Buffer.from(genToken(message.author.tag, email)).toString('base64');
			sendEmail(token, email);
			message.reply(parse(messages.emailSent, {email: email}));
			return;
		}
	} catch(err) { console.log(err); }
	message.reply(messages.invalidEmail);		
}

function addRole(member, roleName) {
	// Going through each guild in guilds
	guilds.forEach(guild => {
		// Finding the role that matches roleName and adding it to the message author
		role = guild.roles.cache.find(role => role.name === roleName);
		guild.members.cache.find(guildMember => guildMember.user == member).roles.add(role);
	});
}

function recToken(message) {
	token = message.content.split(' ')[1];

	if (token) {
		token = Buffer.from(token, 'base64').toString();

		try {
			// Validating the token and getting the token data
			valid = jwt.verify(token, process.env.TOKEN_SECRET);
			tokenData = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());

			// Handling the case the user is already authenticated
			if (members[tokenData.email]) {
				message.reply(messages.alreadyAuthenticated);
				return;
			}
			
			// Adding the user to the db and adding the correct role
			if (valid && tokenData.tag == message.author.tag) {
				members[tokenData.email] = {tag: tokenData.tag, email: tokenData.email}; 
				fs.writeFileSync("./bot/members.json", JSON.stringify(members));
				addRole(message.author, defaultRole); 
				message.reply(messages.tokenAccepted);
				return;
			}
		} catch(err) {
			console.log(err)
		}
	} 
	message.reply(messages.invalidToken);
}

async function sendWelcome(member) {	
	// Ensuring they aren't already a member
	if (!member.roles.cache.some(role => role.name === defaultRole)) {
		
		// Creating DMChannel and sending welcome message
		dm = await member.createDM();
		dm.send(messages.authRequest);
	}
}

function update(message) {
	console.log(message.member.roles)
	if (message.member.roles.cache.find(r => r.name === adminRole || r.name === botManagerRole)) {
		message.channel.send(messages.restart);
		data.restartChannel = message.channel.id;
		fs.writeFileSync('data.json', JSON.stringify(data, null, 4));
		setTimeout(() => {
			shell.exec('./update.sh');
			message.channel.send(messages.restartFailed);
		}, 1000);
	}
	else {
		message.reply(messages.notAllowed)
	}
}

