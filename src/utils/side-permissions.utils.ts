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
    const greenPermissions = SIDE_PERMISSION_FIELDS.filter(
        item => item.side === 'green'
    );

    const bluePermissions = SIDE_PERMISSION_FIELDS.filter(
        item => item.side === 'blue'
    );

    const formatPermissions = (
        permissions: typeof SIDE_PERMISSION_FIELDS[number][]
    ) => {
        return permissions.map(({ field, label, emoji }) => {
            const enabled = Number(player[field]) === 1;

            return `${emoji} **${label}:** ${
                enabled ? '✅ Есть допуск' : '❌ Нет допуска'
            }`;
        }).join('\n');
    };

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
                name: '🟢 Зелёная сторона',
                value: formatPermissions(greenPermissions),
                inline: true
            },
            {
                name: '🔵 Синяя сторона',
                value: formatPermissions(bluePermissions),
                inline: true
            }
        )
        .setFooter({
            text: 'Нажмите кнопку, чтобы изменить соответствующий допуск'
        });

    const buttons = SIDE_PERMISSION_FIELDS.map(
        ({ field, label, emoji }) => {
            const enabled = Number(player[field]) === 1;
            const nextValue = enabled ? 0 : 1;

            return new ButtonBuilder()
                .setCustomId(
                    `sideperm:${player.pUID}:${field}:${nextValue}`
                )
                .setLabel(
                    `${label} · ${enabled ? 'Снять' : 'Выдать'}`
                )
                .setEmoji(emoji)
                .setStyle(
                    enabled
                        ? ButtonStyle.Danger
                        : ButtonStyle.Success
                );
        }
    );

    const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(buttons);

    return {
        embeds: [embed],
        components: [row]
    };
}