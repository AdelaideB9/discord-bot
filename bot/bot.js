require('dotenv').config();

const Discord = require('discord.js');
const client = new Discord.Client();
const fs = require('fs');
const shell = require('shelljs'); // interact with the OS's shell
const jwt = require('jsonwebtoken');
const sgMail = require('@sendgrid/mail');
const crypto = require('crypto')

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Loading data
let data = JSON.parse(fs.readFileSync('./bot/data.json'));
let members;

try {
	members = JSON.parse(fs.readFileSync('./bot/members.json'));
} catch(err) {
	members = {}
}

let message = JSON.parse(fs.readFileSync('./bot/messages.json'));
let guilds = [];

const result = {
	TOKEN_ACCEPTED: "tokenAccepted",
	INVALID_TOKEN: "invalidToken",
	ALREADY_AUTHENTICATED: "alreadyAuthenticated",
	EMAIL_SENT: "emailSent",
	INVALID_EMAIL: "invalidEmail",
	EMAIL_FAILED: "emailFailed",
	ROLE_ADD_FAILED: "roleAddFailed"
}

const TOKEN_SECRET = crypto.randomBytes(20).toString('hex');
console.log("TOKEN_SECRET: " + TOKEN_SECRET);

const { prefix, adminRole, botManagerRole, emailRegex, defaultRole } = require('./config.json');

client.on('ready', () => {
	console.log(`Logged in as ${client.user.tag}!`);

	client.user.setPresence({ activity: { name: "I don't work pls help meowwwww", type: "COMPETING" } })
		.then(console.log)
		.catch(console.error);

	client.channels.cache.get(data.restartChannel).send(message.restartComplete);

	// Adding guilds to guilds array
	client.guilds.cache.forEach(guild => {
		guilds.push(guild)
	});


	fs.readFile('./content/welcome.md', 'utf8', (err, message) => {
		if (err) { console.log("Failed to read welcome.md"); }
		else {
			client.channels.cache.get(data.welcomeChannel).messages.fetch("830702450339479602")
			.then(msg => {
				msg.edit(message)
					.then(msg => console.log("Welcome message updated!"))
					.catch(console.error);
			})
			.catch(console.error);
		}
	});
	fs.readFile('./content/resources.md', 'utf8', (err, message) => {
		if (err) { console.log("Failed to read resources.md"); }
		else {
			client.channels.cache.get(data.resourcesChannel).messages.fetch("830708576284049409")
			.then(msg => {
				msg.edit(message)
					.then(msg => console.log("Resources message updated!"))
					.catch(console.error);
			})
			.catch(console.error);
		}
	});
});

// Adding guild to guilds whenever one joins
client.on('guildCreate', guild => {
	guilds.push(guild);
});

client.on('message', async (msg) => {
	if (msg.channel.type == 'dm') {

		// Messages within DMs
		let args = msg.content.split(' ');

		if (args[0] == `${prefix}auth`) {

			if (args.length == 2) {
				let result = await authenticate(msg.author.id, args[1]);
				msg.reply(parse(message[result], { email: args[1], prefix: prefix }));
			} else {
				msg.reply(parse(message.authHelp, { prefix: prefix }));
			}

		} else if (args[0] == `${prefix}token`) {

			if (args.length == 2) {
				let result = receiveToken(msg.author.id, args[1]);
				msg.reply(message[result]);
			} else {
				msg.reply(parse(message.tokenHelp, { prefix: prefix }));
			}

		}

	} else {

		// Messages within the server
		if (msg.content == 'ping') {

			msg.reply('pong');

		} else if (msg.content == `${prefix}update` || msg.content == `${prefix}restart`) {

			if (msg.member.roles.cache.find(r => r.name == adminRole || r.name == botManagerRole)) {
				msg.channel.send(message.restarting);
				data.restartChannel = msg.channel.id;
				saveData();
				setTimeout(() => {
					shell.exec('./bot/update.sh');
					msg.channel.send(message.restartFailed);
				}, 1000);
			} else {
				msg.reply(message.notAllowed)
			}

		}

	}
});

client.on('guildMemberAdd', member => {
	if (!member.roles.cache.some(role => role.name == "member")) {
		sendWelcome(member);
	}
});

client.login(process.env.TOKEN)

function genToken(id, email) {
	return jwt.sign(
		{
			id: id,
			email: email
		},
		TOKEN_SECRET,
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

async function sendEmail(token, email) {
	const msg = {
		to: email,
		from: 'noreply@adelaideb9.com',
		subject: 'Discord Authentication',
		text: parse(message.authEmail, { token: token })
	};

	try {
		await sgMail.send(msg);
		return result.EMAIL_SENT;

	} catch (error) {
		console.error(error);
		return result.EMAIL_FAILED;
	}
}

async function authenticate(id, email) {
	if (email) {
		try {
			// Getting email from input with regex
			let re = new RegExp(emailRegex);
			email = email.toLowerCase();
			email = re.exec(email)[0];

			if (email) {
				// Already authenticated
				if (members[id]) {
					return result.ALREADY_AUTHENTICATED;
				}

				// Generate token and send email
				token = Buffer.from(genToken(id, email)).toString('base64');
				return await sendEmail(token, email);
			}

		} catch (err) {
			console.log(err);
		}
	}

	return result.INVALID_EMAIL;
}

function addRole(id, roleName) {
	failed = true;
	// Going through each guild in guilds
	guilds.forEach(guild => {
		try {
			// Finding the role that matches roleName and adding it to the msg author
			role = guild.roles.cache.find(role => role.name === roleName);

			if (role) {
				guild.members.cache.find(guildMember => guildMember.user.id == id).roles.add(role);
				failed = false;
			}

		} catch (err) {
			failed = true;
		}
	});

	if (failed)
		return result.ROLE_ADD_FAILED;
}

function receiveToken(id, token) {
	if (token) {
		token = Buffer.from(token, 'base64').toString();

		try {
			// Validating the token and getting the token data
			valid = jwt.verify(token, TOKEN_SECRET);
			tokenData = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());

			// Handling the case the user is already authenticated
			if (members[id]) {
				return result.ALREADY_AUTHENTICATED;
			}

			// Adding the user to the db and adding the correct role
			if (valid && tokenData.id == id) {
				if (addRole(id, defaultRole) == result.ROLE_ADD_FAILED)
					return result.ROLE_ADD_FAILED;

				members[id] = tokenData.email;
				fs.writeFileSync("./bot/members.json", JSON.stringify(members));

				return result.TOKEN_ACCEPTED;
			}
		} catch (err) {
			console.log(err)
		}
	}

	return result.INVALID_TOKEN;
}

async function sendWelcome(member) {
	// Ensuring they aren't already a member
	if (!member.roles.cache.some(role => role.name == defaultRole)) {
		// Creating DMChannel and sending welcome msg
		dm = await member.createDM();
		dm.send(parse(message.authRequest, { prefix: prefix }));
	}
}

function saveData() {
	fs.writeFileSync('./bot/data.json', JSON.stringify(data, null, 4));
}

