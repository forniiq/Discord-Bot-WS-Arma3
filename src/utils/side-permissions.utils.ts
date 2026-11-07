import {
    ActionRowBuilder,
    StringSelectMenuBuilder
} from 'discord.js';

import type { PlayerInfo } from '@/database/queries';

export const SIDE_PERMISSION_FIELDS = [
    {
        field: 'pIND_BTV',
        label: '🟢 Зелёная сторона — БТВ'
    },
    {
        field: 'pIND_CYP',
        label: '🟢 Зелёная сторона — ВВС'
    },
    {
        field: 'pBLU_BTV',
        label: '🔵 Синяя сторона — БТВ'
    },
    {
        field: 'pBLU_CYP',
        label: '🔵 Синяя сторона — ВВС'
    }
] as const;

export type SidePermissionField =
    typeof SIDE_PERMISSION_FIELDS[number]['field'];

export function buildSidePermissionsPanel(player: PlayerInfo) {
    const rows = SIDE_PERMISSION_FIELDS.map(({ field, label }) => {
        const currentValue = Number(player[field] ?? 0);

        const menu = new StringSelectMenuBuilder()
            .setCustomId(`save_side_permission:${player.pUID}:${field}`)
            .setPlaceholder(label)
            .addOptions(
                {
                    label: 'Нет допуска',
                    value: '0',
                    default: currentValue === 0
                },
                {
                    label: 'Есть допуск',
                    value: '1',
                    default: currentValue === 1
                }
            );

        return new ActionRowBuilder<StringSelectMenuBuilder>()
            .addComponents(menu);
    });

    const status = SIDE_PERMISSION_FIELDS.map(({ field, label }) => {
        const value = Number(player[field] ?? 0);

        return `**${label}:** ${
            value === 1 ? '✅ Есть допуск' : '❌ Нет допуска'
        }`;
    }).join('\n');

    return {
        content:
            `🛡️ **Допуски сторон игрока: ${player.pName}**\n\n` +
            `${status}\n\n` +
            'Выберите новое значение в нужном списке:',

        components: rows
    };
}