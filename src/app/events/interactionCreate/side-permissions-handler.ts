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
        !interaction.isButton() ||
        !interaction.customId.startsWith('sideperm:')
    ) {
        return;
    }

    if (!(await requireOperator(interaction.user.id))) {
        return void interaction.reply({
            content: '❌ У вас нет доступа к этому действию.',
            flags: MessageFlags.Ephemeral
        });
    }

    const [, pUID, field, rawValue] = interaction.customId.split(':');

    const permission = SIDE_PERMISSION_FIELDS.find(
        item => item.field === field
    );

    if (!rawValue) return;

    if (!pUID || !permission || !['0', '1'].includes(rawValue)) {
        return void interaction.reply({
            content: '❌ Некорректные параметры изменения допуска.',
            flags: MessageFlags.Ephemeral
        });
    }

    const value = Number(rawValue);

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
            content: '❌ Не удалось сохранить изменения.',
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

    const action = value === 1 ? 'выдал' : 'снял';

    await sendLog(
        'INFO',
        'AdminEdit',
        `Администратор \`${interaction.user.tag}\` ${action} ` +
        `допуск **${permission.label} (${permission.side === 'green' ? 'Зелёная сторона' : 'Синяя сторона'})** ` +
        `игроку \`${updatedPlayer.pName}\` (pUID: ${pUID})`
    );

    return void interaction.update(
        buildSidePermissionsPanel(updatedPlayer)
    );
};

export default handler;