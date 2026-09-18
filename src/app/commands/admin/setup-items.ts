import { SERVER_CONFIG } from '@/config/server.config';

import type {
    ChatInputCommand,
    CommandData,
    CommandMetadata,
} from 'commandkit';

import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    ApplicationCommandOptionType,
    ChannelType,
} from 'discord.js';

export const metadata: CommandMetadata = {
    userPermissions: 'Administrator',

    guilds: SERVER_CONFIG.discord.guildId
        ? [SERVER_CONFIG.discord.guildId]
        : undefined,
};

export const command: CommandData = {
    name: 'setup-items',
    description: '🎒 Отправить панель управления донатными предметами',

    options: [
        {
            name: 'channel',
            description: 'Канал для отправки панели (по умолчанию — текущий)',
            type: ApplicationCommandOptionType.Channel,
            channel_types: [
                ChannelType.GuildText,
                ChannelType.GuildAnnouncement,
            ],
            required: false,
        },
    ],
};

export const chatInput: ChatInputCommand = async (ctx) => {
    if (!ctx.interaction.guild) {
        return;
    }

    const resolvedChannel =
        ctx.interaction.options.getChannel('channel');

    let targetChannel: any = ctx.interaction.channel;

    if (resolvedChannel) {
        try {
            const fetchedChannel =
                ctx.interaction.guild.channels.cache.get(
                    resolvedChannel.id
                ) ||
                await ctx.interaction.guild.channels.fetch(
                    resolvedChannel.id
                );

            if (
                fetchedChannel &&
                'send' in fetchedChannel
            ) {
                targetChannel = fetchedChannel;
            }
        } catch {
            targetChannel = null;
        }
    }

    if (
        !targetChannel ||
        !('send' in targetChannel)
    ) {
        return void ctx.interaction.reply({
            content:
                '❌ **Ошибка:** указанный канал не найден или в него нельзя отправлять сообщения.',
            ephemeral: true,
        });
    }

    const embed = new EmbedBuilder()
        .setTitle('🎒 УПРАВЛЕНИЕ DONATE ITEMS')
        .setDescription(
            'Панель управления донатным снаряжением игроков War Spectra.\n\n' +
            'Здесь уполномоченная администрация может:\n' +
            '• добавить игроку донатный предмет;\n' +
            '• просмотреть предметы игрока;\n' +
            '• изменить существующий предмет;\n' +
            '• удалить предмет.\n\n' +
            '⚠️ Все изменения фиксируются в журнале администрации.'
        )
        .setColor('#5865F2')
        .setFooter({
            text: 'War Spectra Bot • Управление Items',
        })
        .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('items_add')
                .setLabel('Добавить item')
                .setEmoji('➕')
                .setStyle(ButtonStyle.Success),

            new ButtonBuilder()
                .setCustomId('items_player')
                .setLabel('Items игрока')
                .setEmoji('🔎')
                .setStyle(ButtonStyle.Primary),
        );

    try {
        await targetChannel.send({
            embeds: [embed],
            components: [row],
        });

        return void ctx.interaction.reply({
            content:
                `✅ Панель управления Items отправлена в <#${targetChannel.id}>.`,
            ephemeral: true,
        });
    } catch (error) {
        return void ctx.interaction.reply({
            content:
                `❌ Не удалось отправить панель: ${error}`,
            ephemeral: true,
        });
    }
};