import { EventHandler } from 'commandkit';

import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    ModalBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js';

import { SERVER_CONFIG } from '@/config/server.config';

import {
    addPlayerItem,
    editPlayerItem,
    getPlayerItem,
    getPlayerItems,
    getItemSideName,
    isValidItemSide,
    isValidSteamId,
    removePlayerItem,
} from '@/services/items.service';

import crypto from 'node:crypto';

import { findPlayer } from '@/database/queries/players.queries';

import { sendAdminLog } from '@/utils/logger.utils';

const ITEMS_ROLE_ID =
    SERVER_CONFIG.discord.roles.itemsManager;

interface PendingItem {
    steamid: string;
    className: string;
    days: number;
    userId: string;
    expiresAt: number;
}

const pendingItems = new Map<
    string,
    PendingItem
>();

function createPendingItem(
    data: Omit<PendingItem, 'expiresAt'>
): string {
    const token =
        crypto.randomUUID();

    pendingItems.set(token, {
        ...data,
        expiresAt:
            Date.now() + 5 * 60 * 1000,
    });

    return token;
}

function getPendingItem(
    token: string,
    userId: string
): PendingItem | null {
    const data =
        pendingItems.get(token);

    if (!data) {
        return null;
    }

    if (
        data.userId !== userId ||
        data.expiresAt < Date.now()
    ) {
        pendingItems.delete(token);
        return null;
    }

    return data;
}

interface PendingEditItem {
    itemId: number;
    className: string;
    days: number;
    userId: string;
    expiresAt: number;
}

const pendingEditItems = new Map<
    string,
    PendingEditItem
>();

function createPendingEditItem(
    data: Omit<PendingEditItem, 'expiresAt'>
): string {
    const token =
        crypto.randomUUID();

    pendingEditItems.set(token, {
        ...data,
        expiresAt:
            Date.now() + 5 * 60 * 1000,
    });

    return token;
}

function getPendingEditItem(
    token: string,
    userId: string
): PendingEditItem | null {
    const data =
        pendingEditItems.get(token);

    if (!data) {
        return null;
    }

    if (
        data.userId !== userId ||
        data.expiresAt < Date.now()
    ) {
        pendingEditItems.delete(token);
        return null;
    }

    return data;
}

async function hasItemsAccess(
    interaction: any
): Promise<boolean> {
    if (!interaction.guild) {
        return false;
    }

    if (!ITEMS_ROLE_ID) {
        return false;
    }

    try {
        const member =
            await interaction.guild.members.fetch(
                interaction.user.id
            );

        return member.roles.cache.has(
            ITEMS_ROLE_ID
        );
    } catch {
        return false;
    }
}

function formatDate(
    date: Date | string
): string {
    const value = new Date(date);

    return value.toLocaleString(
        'ru-RU',
        {
            timeZone: 'Europe/Moscow',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        }
    );
}

function escapeMarkdown(
    value: string
): string {
    return value
        .replace(/\\/g, '\\\\')
        .replace(/\*/g, '\\*')
        .replace(/_/g, '\\_')
        .replace(/`/g, '\\`');
}

async function getPlayerName(
    steamid: string
): Promise<string> {
    const player = await findPlayer({
        steamId: steamid,
    });

    return player?.pName ?? 'Неизвестный игрок';
}

function createPlayerSearchModal(): ModalBuilder {
    const modal = new ModalBuilder()
        .setCustomId('items_modal_player')
        .setTitle('Поиск Items игрока');

    const steamIdInput = new TextInputBuilder()
        .setCustomId('steamid')
        .setLabel('SteamID64 игрока')
        .setPlaceholder('76561198390295330')
        .setStyle(TextInputStyle.Short)
        .setMinLength(17)
        .setMaxLength(17)
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>()
            .addComponents(steamIdInput)
    );

    return modal;
}

function createAddItemModal(): ModalBuilder {
    const modal = new ModalBuilder()
        .setCustomId('items_modal_add')
        .setTitle('Добавление донатного item');

    const steamIdInput =
        new TextInputBuilder()
            .setCustomId('steamid')
            .setLabel('SteamID64 игрока')
            .setPlaceholder(
                '76561198390295330'
            )
            .setStyle(TextInputStyle.Short)
            .setMinLength(17)
            .setMaxLength(17)
            .setRequired(true);

    const classNameInput =
        new TextInputBuilder()
            .setCustomId('className')
            .setLabel('ClassName')
            .setPlaceholder(
                'CUP_U_C_Rocker_04'
            )
            .setStyle(TextInputStyle.Short)
            .setMaxLength(255)
            .setRequired(true);

    const daysInput =
        new TextInputBuilder()
            .setCustomId('days')
            .setLabel('Срок доната в днях')
            .setPlaceholder('Например: 30')
            .setStyle(TextInputStyle.Short)
            .setMinLength(1)
            .setMaxLength(4)
            .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>()
            .addComponents(steamIdInput),

        new ActionRowBuilder<TextInputBuilder>()
            .addComponents(classNameInput),

        new ActionRowBuilder<TextInputBuilder>()
            .addComponents(daysInput)
    );

    return modal;
}

function createEditItemModal(
    item: {
        id: number;
        className: string;
        srok: Date;
    }
): ModalBuilder {
    const modal = new ModalBuilder()
        .setCustomId(
            `items_modal_edit:${item.id}`
        )
        .setTitle('Редактирование item');

    const classNameInput =
        new TextInputBuilder()
            .setCustomId('className')
            .setLabel('ClassName')
            .setValue(item.className)
            .setStyle(TextInputStyle.Short)
            .setMaxLength(255)
            .setRequired(true);

    const remainingDays = Math.max(
        1,
        Math.ceil(
            (
                new Date(item.srok).getTime() -
                Date.now()
            ) /
            (1000 * 60 * 60 * 24)
        )
    );

    const daysInput =
        new TextInputBuilder()
            .setCustomId('days')
            .setLabel('Срок доната в днях')
            .setValue(
                String(remainingDays)
            )
            .setPlaceholder('Например: 30')
            .setStyle(TextInputStyle.Short)
            .setMinLength(1)
            .setMaxLength(4)
            .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>()
            .addComponents(classNameInput),

        new ActionRowBuilder<TextInputBuilder>()
            .addComponents(daysInput)
    );

    return modal;
}

async function showPlayerItems(
    interaction: any,
    steamid: string
) {
    const items = await getPlayerItems(steamid);

    const playerName =
        await getPlayerName(steamid);

    if (!items.length) {
        return void interaction.reply({
            content:
                `ℹ️ У игрока **${escapeMarkdown(playerName)}** нет активных Items.`,
            ephemeral: true,
        });
    }

    const visibleItems = items.slice(0, 25);

    const select = new StringSelectMenuBuilder()
        .setCustomId(
            `items_select:${steamid}`
        )
        .setPlaceholder(
            'Выберите item для управления'
        )
        .addOptions(
            visibleItems.map(
                (item) =>
                    new StringSelectMenuOptionBuilder()
                        .setLabel(
                            item.className.slice(0, 100)
                        )
                        .setDescription(
                            `${getItemSideName(item.code)} • до ${formatDate(item.srok)}`
                        )
                        .setValue(
                            String(item.id)
                        )
                        .setEmoji('🎒')
            )
        );

    const row =
        new ActionRowBuilder<StringSelectMenuBuilder>()
            .addComponents(select);

    const embed = new EmbedBuilder()
        .setTitle('🎒 ITEMS ИГРОКА')
        .setDescription(
            `**Игрок:** ${escapeMarkdown(playerName)}\n` +
            `**SteamID:** \`${steamid}\`\n\n` +
            `Активных предметов: **${items.length}**\n\n` +
            'Выберите предмет из списка ниже.'
        )
        .setColor('#5865F2')
        .setTimestamp();

    if (items.length > 25) {
        embed.setFooter({
            text:
                'Показаны первые 25 предметов из-за ограничения Discord.',
        });
    }

    return void interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true,
    });
}

async function showItem(
    interaction: any,
    itemId: number
) {
    const item =
        await getPlayerItem(itemId);

    if (!item) {
        return void interaction.reply({
            content:
                '❌ Этот item больше не существует.',
            ephemeral: true,
        });
    }

    const playerName =
        await getPlayerName(item.steamid);

    const embed = new EmbedBuilder()
        .setTitle('🎒 ИНФОРМАЦИЯ О ITEM')
        .setColor('#5865F2')
        .addFields(
            {
                name: '👤 Игрок',
                value:
                    `${escapeMarkdown(playerName)}\n\`${item.steamid}\``,
                inline: true,
            },
            {
                name: '📦 ClassName',
                value:
                    `\`${escapeMarkdown(item.className)}\``,
                inline: true,
            },
            {
                name: '🛡️ Сторона',
                value:
                    getItemSideName(item.code),
                inline: true,
            },
            {
                name: '📅 Добавлен',
                value:
                    `\`${formatDate(item.insert_at)}\``,
                inline: true,
            },
            {
                name: '⏳ Истекает',
                value:
                    `\`${formatDate(item.srok)}\``,
                inline: true,
            }
        )
        .setTimestamp();

    const row =
        new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `items_edit:${item.id}`
                    )
                    .setLabel('Редактировать')
                    .setEmoji('✏️')
                    .setStyle(ButtonStyle.Primary),

                new ButtonBuilder()
                    .setCustomId(
                        `items_delete:${item.id}`
                    )
                    .setLabel('Удалить')
                    .setEmoji('🗑️')
                    .setStyle(ButtonStyle.Danger)
            );

    return void interaction.update({
        embeds: [embed],
        components: [row],
    });
}

const handler: EventHandler<'interactionCreate'> =
    async (interaction) => {

    if (!interaction.guild) {
        return;
    }

    if (
        interaction.isButton() &&
        interaction.customId === 'items_add'
    ) {
        if (!await hasItemsAccess(interaction)) {
            return void interaction.reply({
                content:
                    '❌ У вас нет роли для управления донатными Items.',
                ephemeral: true,
            });
        }

        return void interaction.showModal(
            createAddItemModal()
        );
    }

    if (
        interaction.isButton() &&
        interaction.customId === 'items_player'
    ) {
        if (!await hasItemsAccess(interaction)) {
            return void interaction.reply({
                content:
                    '❌ У вас нет роли для управления донатными Items.',
                ephemeral: true,
            });
        }

        return void interaction.showModal(
            createPlayerSearchModal()
        );
    }

    if (
        interaction.isModalSubmit() &&
        interaction.customId === 'items_modal_add'
    ) {
        const steamid =
    interaction.fields
        .getTextInputValue('steamid')
        .trim();

    const className =
        interaction.fields
            .getTextInputValue('className')
            .trim();

    const daysString =
        interaction.fields
            .getTextInputValue('days')
            .trim();

    if (!isValidSteamId(steamid)) {
        return void interaction.reply({
            content:
                '❌ SteamID64 должен состоять ровно из 17 цифр.',
            ephemeral: true,
        });
    }

    const days =
        Number(daysString);

    if (
        !Number.isInteger(days) ||
        days <= 0 ||
        days > 3650
    ) {
        return void interaction.reply({
            content:
                '❌ Срок должен быть целым числом от **1 до 3650 дней**.',
            ephemeral: true,
        });
    }

    const player =
        await findPlayer({
            steamId: steamid,
        });

    if (!player) {
        return void interaction.reply({
            content:
                `❌ Игрок с SteamID \`${steamid}\` не найден в базе.`,
            ephemeral: true,
        });
    }

    const token =
        createPendingItem({
            steamid,
            className,
            days,
            userId: interaction.user.id,
        });

    const sideSelect =
        new StringSelectMenuBuilder()
            .setCustomId(
                `items_add_side:${token}`
            )
            .setPlaceholder(
                'Выберите сторону'
            )
            .addOptions(
                {
                    label: 'Зелёные',
                    description: 'Independent — зелёная сторона',
                    value: 'call isIndependent',
                    emoji: '🟢',
                },
                {
                    label: 'Синие',
                    description: 'BLUFOR — синяя сторона',
                    value: 'call isBlufor',
                    emoji: '🔵',
                },
                {
                    label: 'Красные',
                    description: 'OPFOR — красная сторона',
                    value: 'call isOpfor',
                    emoji: '🔴',
                },
                {
                    label: 'Все стороны',
                    description: 'Предмет доступен всем сторонам',
                    value: 'true',
                    emoji: '⚪',
                }
            );

    const row =
        new ActionRowBuilder<StringSelectMenuBuilder>()
            .addComponents(sideSelect);

    const expiration =
        new Date();

    expiration.setDate(
        expiration.getDate() + days
    );

    const embed =
        new EmbedBuilder()
            .setTitle('🛡️ ВЫБОР СТОРОНЫ')
            .setDescription(
                `Игрок: **${player.pName}**\n` +
                `SteamID: \`${steamid}\`\n\n` +
                `ClassName: \`${className}\`\n` +
                `Срок: **${days} дн.**\n` +
                `Истекает: **${formatDate(expiration)}**\n\n` +
                `Выберите сторону, которой будет доступен предмет.`
            )
            .setColor('#5865F2');

    return void interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true,
    });
    }

    if (
        interaction.isModalSubmit() &&
        interaction.customId === 'items_modal_player'
    ) {
        if (!await hasItemsAccess(interaction)) {
            return void interaction.reply({
                content:
                    '❌ У вас нет роли для управления донатными Items.',
                ephemeral: true,
            });
        }

        const steamid =
            interaction.fields
                .getTextInputValue('steamid')
                .trim();

        if (!isValidSteamId(steamid)) {
            return void interaction.reply({
                content:
                    '❌ SteamID64 должен состоять ровно из 17 цифр.',
                ephemeral: true,
            });
        }

        const player =
            await findPlayer({
                steamId: steamid,
            });

        if (!player) {
            return void interaction.reply({
                content:
                    `❌ Игрок с SteamID \`${steamid}\` не найден в базе.`,
                ephemeral: true,
            });
        }

        return void showPlayerItems(
            interaction,
            steamid
        );
    }

    if (
        interaction.isStringSelectMenu() &&
        interaction.customId.startsWith(
            'items_select:'
        )
    ) {
        if (!await hasItemsAccess(interaction)) {
            return void interaction.reply({
                content:
                    '❌ У вас нет роли для управления донатными Items.',
                ephemeral: true,
            });
        }

        const value = interaction.values[0];

        if (!value) {
            return void interaction.reply({
                content: '❌ Item не выбран.',
                ephemeral: true,
            });
        }

        const itemId = Number(value);

        if (!Number.isInteger(itemId)) {
            return void interaction.reply({
                content: '❌ Некорректный ID item.',
                ephemeral: true,
            });
        }

        return void showItem(
            interaction,
            itemId
        );
    }

    if (
        interaction.isStringSelectMenu() &&
        interaction.customId.startsWith(
            'items_add_side:'
        )
    ) {
        if (!await hasItemsAccess(interaction)) {
            return void interaction.reply({
                content:
                    '❌ У вас нет роли для управления донатными Items.',
                ephemeral: true,
            });
        }

        const token = interaction.customId.split(':')[1];

        if (!token) {
            return void interaction.reply({
                content: '❌ Некорректная сессия добавления.',
                ephemeral: true,
            });
        }

        const pending = getPendingItem(
            token,
            interaction.user.id
        );

        if (!pending) {
            return void interaction.reply({
                content:
                    '❌ Сессия добавления истекла. Начните добавление заново.',
                ephemeral: true,
            });
        }

        const code = interaction.values[0];

        if (!code) {
            return void interaction.reply({
                content: '❌ Сторона не выбрана.',
                ephemeral: true,
            });
        }

        if (!isValidItemSide(code)) {
            return void interaction.reply({
                content: '❌ Некорректная сторона.',
                ephemeral: true,
            });
        }

        await interaction.deferUpdate();

        const result =
            await addPlayerItem({
                steamid:
                    pending.steamid,

                className:
                    pending.className,

                code,

                days:
                    pending.days,
            });

        pendingItems.delete(token);

        if (
            !result.success ||
            !result.item
        ) {
            return void interaction.editReply({
                embeds: [],
                components: [],
                content:
                    `❌ ${result.message ?? 'Не удалось создать item.'}`,
            });
        }

        await sendAdminLog({
            title:
                '➕ Добавлен донатный item',

            description:
                'Администратор добавил новый донатный предмет игроку.',

            color:
                '#57F287',

            fields: [
                {
                    name: '👤 Игрок',
                    value:
                        `${result.playerName ?? 'Неизвестный игрок'}\n\`${result.item.steamid}\``,
                    inline: true,
                },
                {
                    name: '📦 ClassName',
                    value:
                        `\`${result.item.className}\``,
                    inline: true,
                },
                {
                    name: '🛡️ Сторона',
                    value:
                        getItemSideName(
                            result.item.code
                        ),
                    inline: true,
                },
                {
                    name: '⏳ Срок',
                    value:
                        `\`${formatDate(result.item.srok)}\``,
                    inline: true,
                },
            ],

            executorId:
                interaction.user.id,
        });

        return void interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setTitle(
                        '✅ ITEM ДОБАВЛЕН'
                    )
                    .setDescription(
                        `Донатный предмет успешно добавлен игроку **${escapeMarkdown(result.playerName ?? 'Неизвестный игрок')}**.`
                    )
                    .setColor('#57F287')
                    .addFields(
                        {
                            name: '📦 ClassName',
                            value:
                                `\`${escapeMarkdown(result.item.className)}\``,
                            inline: true,
                        },
                        {
                            name: '🛡️ Сторона',
                            value:
                                getItemSideName(
                                    result.item.code
                                ),
                            inline: true,
                        },
                        {
                            name: '⏳ Истекает',
                            value:
                                `\`${formatDate(result.item.srok)}\``,
                            inline: true,
                        }
                    )
                    .setTimestamp(),
            ],
            components: [],
            content: '',
        });
    }

    if (
        interaction.isStringSelectMenu() &&
        interaction.customId.startsWith(
            'items_edit_side:'
        )
    ) {
        if (!await hasItemsAccess(interaction)) {
            return void interaction.reply({
                content:
                    '❌ У вас нет роли для управления донатными Items.',
                ephemeral: true,
            });
        }

        const token = interaction.customId.split(':')[1];

        if (!token) {
            return void interaction.reply({
                content: '❌ Некорректная сессия редактирования.',
                ephemeral: true,
            });
        }

        const pending = getPendingEditItem(
            token,
            interaction.user.id
        );

        if (!pending) {
            return void interaction.reply({
                content:
                    '❌ Сессия редактирования истекла. Начните редактирование заново.',
                ephemeral: true,
            });
        }

        const code = interaction.values[0];

        if (!code) {
            return void interaction.reply({
                content: '❌ Сторона не выбрана.',
                ephemeral: true,
            });
        }

        if (!isValidItemSide(code)) {
            return void interaction.reply({
                content: '❌ Некорректная сторона.',
                ephemeral: true,
            });
        }

        await interaction.deferUpdate();

        const result =
            await editPlayerItem(
                pending.itemId,
                {
                    className:
                        pending.className,
                    code,
                    days:
                        pending.days,
                }
            );

        pendingEditItems.delete(token);

        if (
            !result.success ||
            !result.item ||
            !result.oldItem
        ) {
            return void interaction.editReply({
                embeds: [],
                components: [],
                content:
                    `❌ ${result.message ?? 'Ошибка изменения item.'}`,
            });
        }

        const playerName =
            await getPlayerName(
                result.item.steamid
            );

        await sendAdminLog({
            title:
                '✏️ Изменён донатный item',

            description:
                'Администратор изменил донатный предмет игрока.',

            color:
                '#FEE75C',

            fields: [
                {
                    name: '👤 Игрок',
                    value:
                        `${playerName}\n\`${result.item.steamid}\``,
                    inline: true,
                },
                {
                    name: '📦 ClassName',
                    value:
                        `\`${result.oldItem.className}\` → \`${result.item.className}\``,
                    inline: false,
                },
                {
                    name: '🛡️ Сторона',
                    value:
                        `${getItemSideName(result.oldItem.code)} → ${getItemSideName(result.item.code)}`,
                    inline: false,
                },
                {
                    name: '⏳ Срок',
                    value:
                        `\`${formatDate(result.oldItem.srok)}\` → \`${formatDate(result.item.srok)}\``,
                    inline: false,
                },
            ],

            executorId:
                interaction.user.id,
        });

        return void interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setTitle(
                        '✅ ITEM ИЗМЕНЁН'
                    )
                    .setDescription(
                        `Предмет игрока **${escapeMarkdown(playerName)}** успешно изменён.`
                    )
                    .setColor('#57F287')
                    .addFields(
                        {
                            name: '📦 ClassName',
                            value:
                                `\`${escapeMarkdown(result.item.className)}\``,
                            inline: true,
                        },
                        {
                            name: '🛡️ Сторона',
                            value:
                                getItemSideName(
                                    result.item.code
                                ),
                            inline: true,
                        },
                        {
                            name: '⏳ Истекает',
                            value:
                                `\`${formatDate(result.item.srok)}\``,
                            inline: true,
                        }
                    )
                    .setTimestamp(),
            ],
            components: [],
            content: '',
        });
    }

    if (
        interaction.isButton() &&
        interaction.customId.startsWith(
            'items_edit:'
        )
    ) {
        if (!await hasItemsAccess(interaction)) {
            return void interaction.reply({
                content:
                    '❌ У вас нет роли для управления донатными Items.',
                ephemeral: true,
            });
        }

        const itemId =
            Number(
                interaction.customId.split(':')[1]
            );

        if (!Number.isInteger(itemId)) {
            return void interaction.reply({
                content:
                    '❌ Некорректный ID item.',
                ephemeral: true,
            });
        }

        const item =
            await getPlayerItem(itemId);

        if (!item) {
            return void interaction.reply({
                content:
                    '❌ Item уже был удалён.',
                ephemeral: true,
            });
        }

        return void interaction.showModal(
            createEditItemModal({
                id: item.id,
                className: item.className,
                srok: item.srok,
            })
        );
    }

    if (
        interaction.isModalSubmit() &&
        interaction.customId.startsWith(
            'items_modal_edit:'
        )
    ) {
        if (!await hasItemsAccess(interaction)) {
            return void interaction.reply({
                content:
                    '❌ У вас нет роли для управления донатными Items.',
                ephemeral: true,
            });
        }

        const itemId =
            Number(
                interaction.customId.split(':')[1]
            );

        if (!Number.isInteger(itemId)) {
            return void interaction.reply({
                content:
                    '❌ Некорректный ID item.',
                ephemeral: true,
            });
        }

        const className =
            interaction.fields
                .getTextInputValue('className')
                .trim();

        const daysString =
            interaction.fields
                .getTextInputValue('days')
                .trim();

        const days =
            Number(daysString);

        if (!className) {
            return void interaction.reply({
                content:
                    '❌ ClassName не может быть пустым.',
                ephemeral: true,
            });
        }

        if (
            !Number.isInteger(days) ||
            days <= 0 ||
            days > 3650
        ) {
            return void interaction.reply({
                content:
                    '❌ Срок должен быть целым числом от **1 до 3650 дней**.',
                ephemeral: true,
            });
        }

        const item =
            await getPlayerItem(itemId);

        if (!item) {
            return void interaction.reply({
                content:
                    '❌ Этот item больше не существует.',
                ephemeral: true,
            });
        }

        const token =
            createPendingEditItem({
                itemId,
                className,
                days,
                userId: interaction.user.id,
            });

        const sideSelect =
            new StringSelectMenuBuilder()
                .setCustomId(
                    `items_edit_side:${token}`
                )
                .setPlaceholder(
                    'Выберите сторону'
                )
                .addOptions(
                    {
                        label: 'Зелёные',
                        description:
                            'Предмет доступен зелёной стороне',
                        value: 'independent',
                        emoji: '🟢',
                    },
                    {
                        label: 'Синие',
                        description:
                            'Предмет доступен синей стороне',
                        value: 'blufor',
                        emoji: '🔵',
                    },
                    {
                        label: 'Красные',
                        description:
                            'Предмет доступен красной стороне',
                        value: 'Opfor',
                        emoji: '🔴',
                    },
                    {
                        label: 'Все стороны',
                        description:
                            'Предмет доступен всем сторонам',
                        value: 'true',
                        emoji: '⚪',
                    }
                );

        const row =
            new ActionRowBuilder<StringSelectMenuBuilder>()
                .addComponents(sideSelect);

        const expiration =
            new Date();

        expiration.setDate(
            expiration.getDate() + days
        );

        const playerName =
            await getPlayerName(
                item.steamid
            );

        const embed =
            new EmbedBuilder()
                .setTitle('✏️ РЕДАКТИРОВАНИЕ ITEM')
                .setDescription(
                    `**Игрок:** ${escapeMarkdown(playerName)}\n` +
                    `**SteamID:** \`${item.steamid}\`\n\n` +
                    `**ClassName:** \`${escapeMarkdown(className)}\`\n` +
                    `**Срок:** ${days} дн.\n` +
                    `**Истекает:** ${formatDate(expiration)}\n\n` +
                    `Выберите новую сторону предмета.`
                )
                .setColor('#FEE75C');

        return void interaction.reply({
            embeds: [embed],
            components: [row],
            ephemeral: true,
        });
    }

    if (
        interaction.isButton() &&
        interaction.customId.startsWith(
            'items_delete:'
        )
    ) {
        if (!await hasItemsAccess(interaction)) {
            return void interaction.reply({
                content:
                    '❌ У вас нет роли для управления донатными Items.',
                ephemeral: true,
            });
        }

        const itemId =
            Number(
                interaction.customId.split(':')[1]
            );

        if (!Number.isInteger(itemId)) {
            return void interaction.reply({
                content:
                    '❌ Некорректный ID item.',
                ephemeral: true,
            });
        }

        const item =
            await getPlayerItem(itemId);

        if (!item) {
            return void interaction.reply({
                content:
                    '❌ Item уже был удалён.',
                ephemeral: true,
            });
        }

        const playerName =
            await getPlayerName(
                item.steamid
            );

        const embed = new EmbedBuilder()
            .setTitle('⚠️ УДАЛЕНИЕ ITEM')
            .setDescription(
                `Вы действительно хотите удалить этот предмет?\n\n` +
                `👤 **Игрок:** ${escapeMarkdown(playerName)}\n` +
                `🎒 **ClassName:** \`${escapeMarkdown(item.className)}\`\n` +
                `🛡️ **Сторона:** ${getItemSideName(item.code)}\n` +
                `⏳ **Срок:** \`${formatDate(item.srok)}\``
            )
            .setColor('#ED4245')
            .setTimestamp();

        const row =
            new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(
                            `items_confirm_delete:${item.id}`
                        )
                        .setLabel('Удалить')
                        .setEmoji('🗑️')
                        .setStyle(ButtonStyle.Danger),

                    new ButtonBuilder()
                        .setCustomId(
                            `items_cancel_delete:${item.id}`
                        )
                        .setLabel('Отмена')
                        .setEmoji('↩️')
                        .setStyle(ButtonStyle.Secondary)
                );

        return void interaction.update({
            embeds: [embed],
            components: [row],
        });
    }

    if (
        interaction.isButton() &&
        interaction.customId.startsWith(
            'items_confirm_delete:'
        )
    ) {
        if (!await hasItemsAccess(interaction)) {
            return void interaction.reply({
                content:
                    '❌ У вас нет роли для управления донатными Items.',
                ephemeral: true,
            });
        }

        const itemId =
            Number(
                interaction.customId.split(':')[1]
            );

        if (!Number.isInteger(itemId)) {
            return void interaction.reply({
                content:
                    '❌ Некорректный ID item.',
                ephemeral: true,
            });
        }

        await interaction.deferUpdate();

        const result =
            await removePlayerItem(itemId);

        if (
            !result.success ||
            !result.item
        ) {
            return void interaction.editReply({
                embeds: [],
                components: [],
                content:
                    `❌ ${result.message ?? 'Не удалось удалить item.'}`,
            });
        }

        const playerName =
            await getPlayerName(
                result.item.steamid
            );

        await sendAdminLog({
            title: '🗑️ Удалён донатный item',
            description:
                `Администратор удалил донатный предмет игрока.`,
            color: '#ED4245',
            fields: [
                {
                    name: '👤 Игрок',
                    value:
                        `${playerName}\n\`${result.item.steamid}\``,
                    inline: true,
                },
                {
                    name: '📦 ClassName',
                    value:
                        `\`${result.item.className}\``,
                    inline: true,
                },
                {
                    name: '🛡️ Сторона',
                    value:
                        getItemSideName(result.item.code),
                    inline: true,
                },
                {
                    name: '⏳ Срок',
                    value:
                        `\`${formatDate(result.item.srok)}\``,
                    inline: true,
                },
            ],
            executorId: interaction.user.id,
        });

        return void interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setTitle('🗑️ ITEM УДАЛЁН')
                    .setDescription(
                        `Предмет игрока **${escapeMarkdown(playerName)}** был удалён.`
                    )
                    .setColor('#ED4245')
                    .addFields({
                        name: '📦 ClassName',
                        value:
                            `\`${escapeMarkdown(result.item.className)}\``,
                    })
                    .setTimestamp(),
            ],
            components: [],
            content: '',
        });
    }

    if (
        interaction.isButton() &&
        interaction.customId.startsWith(
            'items_cancel_delete:'
        )
    ) {
        if (!await hasItemsAccess(interaction)) {
            return void interaction.reply({
                content:
                    '❌ У вас нет роли для управления донатными Items.',
                ephemeral: true,
            });
        }

        const itemId =
            Number(
                interaction.customId.split(':')[1]
            );

        if (!Number.isInteger(itemId)) {
            return void interaction.reply({
                content:
                    '❌ Некорректный ID item.',
                ephemeral: true,
            });
        }

        return void showItem(
            interaction,
            itemId
        );
    }
};

export default handler;