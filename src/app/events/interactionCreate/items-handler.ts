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
    parseExpirationDate,
    removePlayerItem,
} from '@/services/items.service';

import { findPlayer } from '@/database/queries/players.queries';

import { sendAdminLog } from '@/utils/logger.utils';

const ITEMS_ROLE_ID =
    SERVER_CONFIG.discord.roles.itemsManager;

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

function createAddItemModal(): ModalBuilder {
    const modal = new ModalBuilder()
        .setCustomId('items_modal_add')
        .setTitle('Добавление донатного item');

    const steamIdInput = new TextInputBuilder()
        .setCustomId('steamid')
        .setLabel('SteamID64')
        .setPlaceholder('76561198390295330')
        .setStyle(TextInputStyle.Short)
        .setMinLength(17)
        .setMaxLength(17)
        .setRequired(true);

    const classNameInput = new TextInputBuilder()
        .setCustomId('className')
        .setLabel('ClassName')
        .setPlaceholder('CUP_U_C_Rocker_04')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(255)
        .setRequired(true);

    const sideInput = new TextInputBuilder()
        .setCustomId('code')
        .setLabel('Сторона')
        .setPlaceholder(
            'independent / blufor / Opfor / true'
        )
        .setStyle(TextInputStyle.Short)
        .setMaxLength(20)
        .setRequired(true);

    const expirationInput = new TextInputBuilder()
        .setCustomId('srok')
        .setLabel('Срок окончания')
        .setPlaceholder(
            '2026-12-31 23:59:59'
        )
        .setStyle(TextInputStyle.Short)
        .setMaxLength(19)
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>()
            .addComponents(steamIdInput),

        new ActionRowBuilder<TextInputBuilder>()
            .addComponents(classNameInput),

        new ActionRowBuilder<TextInputBuilder>()
            .addComponents(sideInput),

        new ActionRowBuilder<TextInputBuilder>()
            .addComponents(expirationInput),
    );

    return modal;
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

function createEditItemModal(
    item: {
        id: number;
        className: string;
        code: string;
        srok: Date;
    }
): ModalBuilder {
    const modal = new ModalBuilder()
        .setCustomId(`items_modal_edit:${item.id}`)
        .setTitle('Редактирование item');

    const classNameInput = new TextInputBuilder()
        .setCustomId('className')
        .setLabel('ClassName')
        .setValue(item.className)
        .setStyle(TextInputStyle.Short)
        .setMaxLength(255)
        .setRequired(true);

    const sideInput = new TextInputBuilder()
        .setCustomId('code')
        .setLabel('Сторона')
        .setValue(item.code)
        .setStyle(TextInputStyle.Short)
        .setMaxLength(20)
        .setRequired(true);

    const expirationInput = new TextInputBuilder()
        .setCustomId('srok')
        .setLabel('Срок окончания')
        .setValue(formatDateForInput(item.srok))
        .setStyle(TextInputStyle.Short)
        .setMaxLength(19)
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>()
            .addComponents(classNameInput),

        new ActionRowBuilder<TextInputBuilder>()
            .addComponents(sideInput),

        new ActionRowBuilder<TextInputBuilder>()
            .addComponents(expirationInput),
    );

    return modal;
}

function formatDateForInput(
    date: Date
): string {
    const d = new Date(date);

    const year = d.getFullYear();
    const month = String(
        d.getMonth() + 1
    ).padStart(2, '0');

    const day = String(
        d.getDate()
    ).padStart(2, '0');

    const hours = String(
        d.getHours()
    ).padStart(2, '0');

    const minutes = String(
        d.getMinutes()
    ).padStart(2, '0');

    const seconds = String(
        d.getSeconds()
    ).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
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

        const className =
            interaction.fields
                .getTextInputValue('className')
                .trim();

        const code =
            interaction.fields
                .getTextInputValue('code')
                .trim();

        const srokString =
            interaction.fields
                .getTextInputValue('srok')
                .trim();

        if (!isValidSteamId(steamid)) {
            return void interaction.reply({
                content:
                    '❌ SteamID64 должен состоять ровно из 17 цифр.',
                ephemeral: true,
            });
        }

        if (!isValidItemSide(code)) {
            return void interaction.reply({
                content:
                    '❌ Некорректная сторона.\n\n' +
                    'Разрешено:\n' +
                    '`independent` — зелёные\n' +
                    '`blufor` — синие\n' +
                    '`Opfor` — красные\n' +
                    '`true` — все',
                ephemeral: true,
            });
        }

        const srok =
            parseExpirationDate(srokString);

        if (!srok) {
            return void interaction.reply({
                content:
                    '❌ Некорректная дата.\n\n' +
                    'Используйте формат:\n' +
                    '`2026-12-31 23:59:59`',
                ephemeral: true,
            });
        }

        await interaction.deferReply({
            ephemeral: true,
        });

        const result =
            await addPlayerItem({
                steamid,
                className,
                code,
                srok,
            });

        if (!result.success) {
            return void interaction.editReply({
                content:
                    `❌ ${result.message}`,
            });
        }

        const playerName =
            result.playerName ?? 'Неизвестный игрок';

        await sendAdminLog({
            title: '🎒 Выдан донатный item',
            description:
                `Администратор добавил игроку новый донатный предмет.`,
            color: '#57F287',
            fields: [
                {
                    name: '👤 Игрок',
                    value:
                        `${playerName}\n\`${steamid}\``,
                    inline: true,
                },
                {
                    name: '📦 ClassName',
                    value:
                        `\`${className}\``,
                    inline: true,
                },
                {
                    name: '🛡️ Сторона',
                    value:
                        getItemSideName(code),
                    inline: true,
                },
                {
                    name: '⏳ Срок',
                    value:
                        `\`${formatDate(srok)}\``,
                    inline: true,
                },
            ],
            executorId: interaction.user.id,
        });

        return void interaction.editReply({
            content:
                `✅ **Item успешно добавлен.**\n\n` +
                `👤 Игрок: **${playerName}**\n` +
                `🎒 ClassName: \`${className}\`\n` +
                `🛡️ Сторона: ${getItemSideName(code)}\n` +
                `⏳ Срок: \`${formatDate(srok)}\``,
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

        const itemId =
            Number(interaction.values[0]);

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
                code: item.code,
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

        const code =
            interaction.fields
                .getTextInputValue('code')
                .trim();

        const srokString =
            interaction.fields
                .getTextInputValue('srok')
                .trim();

        if (!isValidItemSide(code)) {
            return void interaction.reply({
                content:
                    '❌ Некорректная сторона.\n\n' +
                    '`independent` — зелёные\n' +
                    '`blufor` — синие\n' +
                    '`Opfor` — красные\n' +
                    '`true` — все',
                ephemeral: true,
            });
        }

        const srok =
            parseExpirationDate(srokString);

        if (!srok) {
            return void interaction.reply({
                content:
                    '❌ Некорректная дата.\nИспользуйте `2026-12-31 23:59:59`.',
                ephemeral: true,
            });
        }

        await interaction.deferReply({
            ephemeral: true,
        });

        const result =
            await editPlayerItem(
                itemId,
                {
                    className,
                    code,
                    srok,
                }
            );

        if (
            !result.success ||
            !result.item ||
            !result.oldItem
        ) {
            return void interaction.editReply({
                content:
                    `❌ ${result.message ?? 'Ошибка изменения item.'}`,
            });
        }

        const playerName =
            await getPlayerName(
                result.item.steamid
            );

        await sendAdminLog({
            title: '✏️ Изменён донатный item',
            description:
                `Администратор изменил донатный предмет игрока.`,
            color: '#FEE75C',
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
            executorId: interaction.user.id,
        });

        return void interaction.editReply({
            content:
                `✅ **Item успешно изменён.**\n\n` +
                `👤 Игрок: **${playerName}**\n` +
                `📦 ClassName: \`${result.item.className}\`\n` +
                `🛡️ Сторона: ${getItemSideName(result.item.code)}\n` +
                `⏳ Срок: \`${formatDate(result.item.srok)}\``,
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