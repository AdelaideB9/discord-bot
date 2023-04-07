require('dotenv').config();

const Discord = require('discord.js');
const { Intents, DMChannel } = require('discord.js');
const client = new Discord.Client({ partials: ['MESSAGE', 'CHANNEL', 'REACTION'], intents: [Intents.FLAGS.GUILD_PRESENCES, Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_MEMBERS, Intents.FLAGS.DIRECT_MESSAGES] });
const fs = require('fs');
const shell = require('shelljs'); // interact with the OS's shell
const axios = require('axios');

// Loading data
let data = JSON.parse(fs.readFileSync('./bot/data.json'));
let message = JSON.parse(fs.readFileSync('./bot/messages.json'));
let guild;

const result = {
    TOKEN_ACCEPTED: "tokenAccepted",
    INVALID_TOKEN: "invalidToken",
    ALREADY_AUTHENTICATED: "alreadyAuthenticated",
    ROLE_ADD_FAILED: "roleAddFailed",
    SERVER_ERROR: "serverError",
}

const { prefix, botManagerRole, defaultRole } = require('./config.json');

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);

    console.log(client.user.setPresence({ activities: [{ name: "a super secret CTF", type: "COMPETING" }] }));

    client.channels.cache.get(data.restartChannel).send(message.restartComplete);

    guild = client.guilds.cache.get(data.guildID)

    fs.readFile('./content/welcome.md', 'utf8', async (err, message) => {
        if (err) { console.log("Failed to read welcome.md"); }
        else {
            let welcomeChannel = client.channels.cache.get(data.welcomeChannel)
            let messages = await welcomeChannel.messages.fetch();
            if (messages.size < 1) {
                welcomeChannel.send(message, { split: true });
                console.log("Welcome message updated!");
            } else {
                console.log("Welcome channel already has messages")
            }
        }
    });

    fs.readFile('./content/resources.md', 'utf8', async (err, message) => {
        if (err) { console.log("Failed to read welcome.md"); }
        else {
            let resourcesChannel = client.channels.cache.get(data.resourcesChannel)
            let messages = await resourcesChannel.messages.fetch();
            if (messages.size < 1) {
                resourcesChannel.send(message, { split: true });
                console.log("Resources message updated!");
            } else {
                console.log("Resources channel already has messages")
            }
        }
    });
});

client.on('messageCreate', async (msg) => {
    if (msg.channel instanceof DMChannel) {
        // Messages within DMs
        let args = msg.content.split(' ');

        if (args[0] == `${prefix}auth`) {
            if (args.length == 2) {
                let result = await authenticate(msg.author.id, args[1]);
                msg.reply(parse(message[result], { prefix: prefix }));
            }
        }

    } else {
        // Messages within the server
        if (msg.content == 'ping') {
            if (msg.member.permissions.has("ADMINISTRATOR") || msg.member.roles.cache.find(r => r.name == botManagerRole)) {
                msg.reply('pong');
            }
        } else if (msg.content == `${prefix}update` || msg.content == `${prefix}restart`) {
            if (msg.member.permissions.has("ADMINISTRATOR") || msg.member.roles.cache.find(r => r.name == botManagerRole)) {
                msg.channel.send(message.restarting);
                data.restartChannel = msg.channel.id;
                saveData();
                setTimeout(() => {
                    shell.exec('./bot/update.sh');
                    msg.channel.send(message.restartFailed);
                }, 1000);
            } else {
                msg.reply(message.notAllowed);
            }
        }
    }
});

client.on('guildMemberAdd', member => {
    sendWelcome(member);
});

setInterval(async () => {
    if (guild == undefined) {
        return
    }
    try {
        let res = await axios.get(`${process.env.API_URL}/api/discord/members`);
        role = guild.roles.cache.find(role => role.name === defaultRole);

        if (role) {
            // removing members
            for (const [id, user] of role.members) {
                if (!res.data.includes(id)) {
                    // remove member role
                    await user.roles.remove(role);
                    console.log(`${defaultRole} role removed from '${user.user.tag}'`)
                }

                res.data = res.data.filter(v => v != id)
            }

            // adding new members
            for (const id of res.data) {
                try {
                    user = await guild.members.fetch(id);
                    await user.roles.add(role);
                    console.log(`${defaultRole} role added to '${user.user.tag}'`)
                } catch (err) {
                    // user doesn't exist in this guild
                }
            }
        }
    } catch (err) {
        console.log(err)
    }
}, 1000 * 60)

client.login(process.env.TOKEN);

function parse(template, textMap) {
    let output = template

    for (let [id, text] of Object.entries(textMap)) {
        output = output.replace(new RegExp(`\\$\{${id}}`, 'mg'), text)
    }

    return output
}

async function sendWelcome(member) {
    // Ensuring they aren't already a member
    if (!member.roles.cache.some(role => role.name == defaultRole)) {
        // Creating DMChannel and sending welcome msg
        try {
            dm = await member.createDM();
            await dm.send(parse(message.welcome, { prefix: prefix }));
        } catch (ignore) { }
    }
}

async function addRole(id, roleName) {
    failed = true;
    try {
        // Finding the role that matches roleName and adding it to the msg author
        role = guild.roles.cache.find(role => role.name === roleName);

        if (role) {
            u = await guild.members.fetch(id);
            u.roles.add(role);
            console.log(`${roleName} role added to '${u.user.tag}'`)
            failed = false;
        }

    } catch (err) {
        failed = true;
    }

    if (failed)
        return result.ROLE_ADD_FAILED;
}

async function authenticate(id, token) {
    try {
        await axios.post(`${process.env.API_URL}/api/discord/members/${id}`, { 'token': token });

        if (await addRole(id, defaultRole) == result.ROLE_ADD_FAILED)
            return result.ROLE_ADD_FAILED;

        return result.TOKEN_ACCEPTED;

    } catch (err) {
        if (err.response.status == 422) {
            return result.INVALID_TOKEN;
        } else if (err.response.status >= 500) {
            return result.SERVER_ERROR;
        }

        return result.ALREADY_AUTHENTICATED;
    }
}

function saveData() {
    fs.writeFileSync('./bot/data.json', JSON.stringify(data, null, 4));
}
