import type {
    CommandData,
    CommandMetadata,
    UserContextMenuCommand
} from 'commandkit';

import {
    ApplicationCommandType,
    MessageFlags
} from 'discord.js';

import { findPlayer } from '@/database/queries';
import { SERVER_CONFIG } from '@/config/server.config';
import { requireOperator } from '@/utils/operator.utils';
import { buildSidePermissionsPanel } from '@/utils/side-permissions.utils';

export const metadata: CommandMetadata = {
    guilds: SERVER_CONFIG.discord.guildId
        ? [SERVER_CONFIG.discord.guildId]
        : undefined
};

export const command: CommandData = {
    name: 'Допуски сторон',
    type: ApplicationCommandType.User
};

export const userContextMenu: UserContextMenuCommand = async (ctx) => {
    const interaction = ctx.interaction;

    if (!(await requireOperator(interaction.user.id))) {
        return void interaction.reply({
            content: '❌ У вас нет доступа к редактированию допусков сторон.',
            flags: MessageFlags.Ephemeral
        });
    }

    const player = await findPlayer({
        discordId: interaction.targetUser.id
    });

    if (!player) {
        return void interaction.reply({
            content:
                '❌ Игрок не найден в базе данных. Убедитесь, что у него привязан Discord.',
            flags: MessageFlags.Ephemeral
        });
    }

    return void interaction.reply({
        ...buildSidePermissionsPanel(player),
        flags: MessageFlags.Ephemeral
    });
};