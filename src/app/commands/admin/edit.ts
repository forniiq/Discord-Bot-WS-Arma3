import type { ChatInputCommand, CommandData, CommandMetadata } from 'commandkit';
import { ApplicationCommandOptionType } from 'discord.js';
import { openEditPanel } from '@/services/adminEditService';

export const metadata: CommandMetadata = {
    userPermissions: 'Administrator',
    guilds: [process.env.GUILD_ID as string]
};

export const command: CommandData = {
    name: 'edit',
    description: '💽 Редактирование профиля игрока',
    options: [
        {
            name: 'discord',
            description: 'Пользователь из Discord',
            type: ApplicationCommandOptionType.User,
            required: false,
        },
        {
            name: 'puid',
            description: 'SteamID64 / pUID игрока',
            type: ApplicationCommandOptionType.String,
            required: false,
        }
    ]
};

export const chatInput: ChatInputCommand = async (ctx) => {
    const targetUser = ctx.interaction.options.getUser('discord');
    const pUID = ctx.interaction.options.getString('puid');

    if (!targetUser && !pUID) {
        return void ctx.interaction.reply({
            content: '❌ Укажите хотя бы один параметр: **discord** пользователя или **puid**.',
            ephemeral: true
        });
    }

    await openEditPanel({
        interaction: ctx.interaction,
        targetDiscordUser: targetUser ?? undefined,
        pUID: pUID ?? undefined
    });
};