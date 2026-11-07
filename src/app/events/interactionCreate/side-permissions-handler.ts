import type { EventHandler } from 'commandkit';

import { MessageFlags } from 'discord.js';

import {
    findPlayer,
    updatePlayerField
} from '@/database/queries';

import {
    SIDE_PERMISSION_FIELDS,
    buildSidePermissionsPanel,
    buildSidePermissionEditor,
    type PermissionSide,
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

    const parts = interaction.customId.split(':');

    const action = parts[1];
    const pUID = parts[2];

    if (!action || !pUID) {
        return void interaction.reply({
            content: '❌ Некорректные параметры взаимодействия.',
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

    // Открытие редактора выбранной стороны
    if (action === 'open') {
        const side = parts[3];

        if (side !== 'green' && side !== 'blue') {
            return void interaction.reply({
                content: '❌ Неизвестная сторона.',
                flags: MessageFlags.Ephemeral
            });
        }

        return void interaction.update(
            buildSidePermissionEditor(player, side)
        );
    }

    // Возврат к стартовой панели
    if (action === 'back') {
        return void interaction.update(
            buildSidePermissionsPanel(player)
        );
    }

    // Изменение допуска
    if (action === 'set') {
        const field = parts[3];
        const rawValue = parts[4];

        const permission = SIDE_PERMISSION_FIELDS.find(
            item => item.field === field
        );

        if (
            !permission ||
            !rawValue ||
            !['0', '1'].includes(rawValue)
        ) {
            return void interaction.reply({
                content: '❌ Некорректные параметры изменения допуска.',
                flags: MessageFlags.Ephemeral
            });
        }

        const value = Number(rawValue);

        const saved = await updatePlayerField(
            pUID,
            permission.field as SidePermissionField,
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

        const actionText = value === 1 ? 'выдал' : 'снял';

        const sideName: Record<PermissionSide, string> = {
            green: 'Зелёная сторона',
            blue: 'Синяя сторона'
        };

        await sendLog(
            'INFO',
            'AdminEdit',
            `Администратор \`${interaction.user.tag}\` ${actionText} ` +
            `допуск **${permission.label} (${sideName[permission.side]})** ` +
            `игроку \`${updatedPlayer.pName}\` (pUID: ${pUID})`
        );

        return void interaction.update(
            buildSidePermissionEditor(updatedPlayer, permission.side)
        );
    }

    return void interaction.reply({
        content: '❌ Неизвестное действие.',
        flags: MessageFlags.Ephemeral
    });
};

export default handler;