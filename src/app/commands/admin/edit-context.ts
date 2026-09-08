import type { CommandData, CommandMetadata, UserContextMenuCommand } from 'commandkit';
import { ApplicationCommandType } from 'discord.js';
import { openEditPanel } from '@/services/admin-edit.service';
import { SERVER_CONFIG } from '@/config/server.config';
import { requireOperator } from '@/utils/operator.utils';

export const metadata: CommandMetadata = {
    guilds: SERVER_CONFIG.discord.guildId ? [SERVER_CONFIG.discord.guildId] : undefined
};

export const command: CommandData = {
    name: 'Редактировать игрока',
    type: ApplicationCommandType.User,
};

export const userContextMenu: UserContextMenuCommand = async (ctx) => {
    const interaction = ctx.interaction;

    if (!(await requireOperator(interaction.user.id))) {
        return void interaction.reply({
            content: '❌ У вас нет доступа к редактированию игроков.',
            ephemeral: true
        });
    }

    const targetUser = interaction.targetUser;

    await openEditPanel({
        interaction: interaction,
        targetDiscordUser: targetUser,
    });
};