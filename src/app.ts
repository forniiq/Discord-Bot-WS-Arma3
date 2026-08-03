import { Client } from 'discord.js';

const client = new Client({
  intents: [
    'Guilds',
    'GuildMembers',
    'GuildModeration',
    'GuildMessages',
    'MessageContent'
  ],
});

export default client;
