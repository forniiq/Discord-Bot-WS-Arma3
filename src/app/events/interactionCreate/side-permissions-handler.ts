import type { EventHandler } from 'commandkit';

import { MessageFlags } from 'discord.js';

import {
    findPlayer,
    updatePlayerField
} from '@/database/queries';

import {
    SIDE_PERMISSION_FIELDS,
    buildSidePermissionsPanel,
    type SidePermissionField
} from '@/utils/side-permissions.utils';

import { sendLog } from '@/utils/logger.utils';
import { requireOperator } from '@/utils/operator.utils';

const handler: EventHandler<'interactionCreate'> = async (interaction) => {
    if (
        !interaction.isStringSelectMenu() ||
        !interaction.customId.startsWith('save_side_permission:')
    ) {
        return;
    }

    if (!interaction.guild) return;

    if (!(await requireOperator(interaction.user.id))) {
        return void interaction.reply({
            content: '❌ У вас нет доступа к этому действию.',
            flags: MessageFlags.Ephemeral
        });
    }

    const [, pUID, field] = interaction.customId.split(':');

    if (
        !pUID ||
        !SIDE_PERMISSION_FIELDS.some(item => item.field === field)
    ) {
        return void interaction.reply({
            content: '❌ Некорректное поле допуска.',
            flags: MessageFlags.Ephemeral
        });
    }

    const value = Number(interaction.values[0]);

    if (value !== 0 && value !== 1) {
        return void interaction.reply({
            content: '❌ Допустимые значения: 0 или 1.',
            flags: MessageFlags.Ephemeral
        });
    }

    const player = await findPlayer({
        steamId: pUID
    });

    if (!player) {
        return void interaction.reply({
            content: '❌ Игрок не найден в базе данных.',
            flags: MessageFlags.Ephemeral
        });
    }

    const saved = await updatePlayerField(
        pUID,
        field as SidePermissionField,
        value
    );

    if (!saved) {
        return void interaction.reply({
            content: '❌ Не удалось сохранить допуск в базе данных.',
            flags: MessageFlags.Ephemeral
        });
    }

    const updatedPlayer = await findPlayer({
        steamId: pUID
    });

    if (!updatedPlayer) {
        return void interaction.reply({
            content: '⚠️ Допуск сохранён, но профиль не удалось загрузить.',
            flags: MessageFlags.Ephemeral
        });
    }

    const permission = SIDE_PERMISSION_FIELDS.find(
        item => item.field === field
    );

    const status = value === 1 ? 'выдан' : 'снят';

    await sendLog(
        'INFO',
        'AdminEdit',
        `Администратор \`${interaction.user.tag}\` ${status} ` +
        `допуск **${permission?.label ?? field}** игроку ` +
        `\`${updatedPlayer.pName}\` (pUID: ${pUID})`
    );

    return void interaction.update(
        buildSidePermissionsPanel(updatedPlayer)
    );
};

export default handler;