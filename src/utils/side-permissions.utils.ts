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

export type PermissionSide = 'green' | 'blue';

// Стартовая панель
export function buildSidePermissionsPanel(player: PlayerInfo) {
    const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setTitle('🛡️ Управление допусками игрока')
        .setDescription(
            `**Игрок:** ${player.pName}\n` +
            `**Steam ID:** \`${player.pUID}\`\n` +
            `**Discord:** ${player.DiscID ? `<@${player.DiscID}>` : 'Не привязан'}`
        )
        .addFields(
            {
                name: '🟢 Зелёная сторона',
                value:
                    `${formatPermission(player.pIND_BTV, '🚜 БТВ')}\n` +
                    `${formatPermission(player.pIND_CYP, '✈️ ВВС')}`,
                inline: true
            },
            {
                name: '🔵 Синяя сторона',
                value:
                    `${formatPermission(player.pBLU_BTV, '🚜 БТВ')}\n` +
                    `${formatPermission(player.pBLU_CYP, '✈️ ВВС')}`,
                inline: true
            }
        )
        .setFooter({
            text: 'Выберите сторону для управления её допусками'
        });

    const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`sideperm:open:${player.pUID}:green`)
                .setLabel('Редактировать зелёную сторону')
                .setEmoji('🟢')
                .setStyle(ButtonStyle.Success),

            new ButtonBuilder()
                .setCustomId(`sideperm:open:${player.pUID}:blue`)
                .setLabel('Редактировать синюю сторону')
                .setEmoji('🔵')
                .setStyle(ButtonStyle.Primary)
        );

    return {
        embeds: [embed],
        components: [row]
    };
}

// Панель редактирования конкретной стороны
export function buildSidePermissionEditor(
    player: PlayerInfo,
    side: PermissionSide
) {
    const isGreen = side === 'green';

    const permissions = SIDE_PERMISSION_FIELDS.filter(
        item => item.side === side
    );

    const embed = new EmbedBuilder()
        .setColor(isGreen ? 0x2ecc71 : 0x3498db)
        .setTitle(
            `${isGreen ? '🟢 Зелёная' : '🔵 Синяя'} сторона`
        )
        .setDescription(
            `**Игрок:** ${player.pName}\n` +
            `**Steam ID:** \`${player.pUID}\`\n\n` +
            'Выберите допуск, который хотите изменить.'
        )
        .addFields(
            permissions.map(({ field, label, emoji }) => ({
                name: `${emoji} ${label}`,
                value: Number(player[field]) === 1
                    ? '✅ **Допуск выдан**'
                    : '❌ **Допуск отсутствует**',
                inline: true
            }))
        )
        .setFooter({
            text: 'Изменения сохраняются сразу после нажатия'
        });

    const permissionButtons = permissions.map(permission => {
        const enabled = Number(player[permission.field]) === 1;

        return new ButtonBuilder()
            .setCustomId(
                `sideperm:set:${player.pUID}:${permission.field}:${enabled ? 0 : 1}`
            )
            .setLabel(
                `${permission.label} · ${enabled ? 'Снять' : 'Выдать'}`
            )
            .setEmoji(permission.emoji)
            .setStyle(
                enabled
                    ? ButtonStyle.Danger
                    : ButtonStyle.Success
            );
    });

    const permissionRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(permissionButtons);

    const backRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`sideperm:back:${player.pUID}`)
                .setLabel('Назад к выбору стороны')
                .setEmoji('↩️')
                .setStyle(ButtonStyle.Secondary)
        );

    return {
        embeds: [embed],
        components: [permissionRow, backRow]
    };
}

function formatPermission(value: number, label: string): string {
    return `${label}: ${Number(value) === 1 ? '✅' : '❌'}`;
}