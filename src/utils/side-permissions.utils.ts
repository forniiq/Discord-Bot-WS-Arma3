import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder
} from 'discord.js';

import type { PlayerInfo } from '@/database/queries';

export const SIDE_PERMISSION_FIELDS = [
    {
        field: 'pIND_BTV',
        side: 'green',
        label: 'БТВ',
        emoji: '🚜'
    },
    {
        field: 'pIND_CYP',
        side: 'green',
        label: 'ВВС',
        emoji: '✈️'
    },
    {
        field: 'pBLU_BTV',
        side: 'blue',
        label: 'БТВ',
        emoji: '🚜'
    },
    {
        field: 'pBLU_CYP',
        side: 'blue',
        label: 'ВВС',
        emoji: '✈️'
    }
] as const;

export type SidePermissionField =
    typeof SIDE_PERMISSION_FIELDS[number]['field'];

export function buildSidePermissionsPanel(player: PlayerInfo) {
    const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setTitle('🛡️ Управление допусками')
        .setDescription(
            `**Игрок:** ${player.pName}\n` +
            `**Steam ID:** \`${player.pUID}\`\n` +
            `**Discord:** ${player.DiscID ? `<@${player.DiscID}>` : 'Не привязан'}`
        )
        .addFields(
            {
                name: '🟢 ЗЕЛЁНАЯ СТОРОНА',
                value:
                    `${formatPermission(player.pIND_BTV, '🚜 БТВ')}\n` +
                    `${formatPermission(player.pIND_CYP, '✈️ ВВС')}`,
                inline: false
            },
            {
                name: '🔵 СИНЯЯ СТОРОНА',
                value:
                    `${formatPermission(player.pBLU_BTV, '🚜 БТВ')}\n` +
                    `${formatPermission(player.pBLU_CYP, '✈️ ВВС')}`,
                inline: false
            }
        )
        .setFooter({
            text: 'Кнопки сгруппированы по соответствующим сторонам'
        });

    const greenButtons = SIDE_PERMISSION_FIELDS
        .filter(item => item.side === 'green')
        .map(item => createPermissionButton(player, item));

    const blueButtons = SIDE_PERMISSION_FIELDS
        .filter(item => item.side === 'blue')
        .map(item => createPermissionButton(player, item));

    return {
        embeds: [embed],
        components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(greenButtons),
            new ActionRowBuilder<ButtonBuilder>().addComponents(blueButtons)
        ]
    };
}

function formatPermission(value: number, label: string): string {
    return `${label}: ${Number(value) === 1 ? '✅ Есть допуск' : '❌ Нет допуска'}`;
}

function createPermissionButton(
    player: PlayerInfo,
    permission: typeof SIDE_PERMISSION_FIELDS[number]
): ButtonBuilder {
    const enabled = Number(player[permission.field]) === 1;

    return new ButtonBuilder()
        .setCustomId(
            `sideperm:${player.pUID}:${permission.field}:${enabled ? 0 : 1}`
        )
        .setLabel(`${permission.label} · ${enabled ? 'Снять' : 'Выдать'}`)
        .setEmoji(permission.emoji)
        .setStyle(enabled ? ButtonStyle.Danger : ButtonStyle.Success);
}