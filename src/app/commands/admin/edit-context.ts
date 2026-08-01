import type { CommandData, CommandMetadata, UserContextMenuCommand } from 'commandkit';
import { ApplicationCommandType } from 'discord.js';
import { openEditPanel } from '@/services/adminEditService';

export const metadata: CommandMetadata = {
    userPermissions: 'Administrator',
    guilds: [process.env.GUILD_ID as string]
};

export const command: CommandData = {
    name: 'Редактировать игрока',
    type: ApplicationCommandType.User,
};

export const userContextMenu: UserContextMenuCommand = async (ctx) => {
    const interaction = ctx.interaction;
    const targetUser = interaction.targetUser;

    await openEditPanel({
        interaction: interaction,
        targetDiscordUser: targetUser,
    });
};