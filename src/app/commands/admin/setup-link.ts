// Создание Embed для привязки

import type { ChatInputCommand, CommandData, CommandMetadata } from 'commandkit';
import { 
    ApplicationCommandOptionType, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder, 
    ChannelType 
} from 'discord.js';

export const metadata: CommandMetadata = {
    userPermissions: 'Administrator',
    guilds: [process.env.GUILD_ID as string]
};

export const command: CommandData = {
    name: 'setup-link',
    description: '📢 Отправить панель привязки аккаунта и синхронизации ролей',
    options: [
        {
            name: 'channel',
            description: 'Канал для отправки панели (по умолчанию — текущий)',
            type: ApplicationCommandOptionType.Channel,
            channel_types: [ChannelType.GuildText, ChannelType.GuildAnnouncement],
            required: false,
        }
    ]
};

export const chatInput: ChatInputCommand = async (ctx) => {
    if (!ctx.interaction.guild) return;

    const resolvedChannel = ctx.interaction.options.getChannel('channel');
    let targetChannel: any = ctx.interaction.channel;

    if (resolvedChannel) {
        try {
            const fetchedChannel = ctx.interaction.guild.channels.cache.get(resolvedChannel.id) 
                || await ctx.interaction.guild.channels.fetch(resolvedChannel.id);
            if (fetchedChannel && 'send' in fetchedChannel) {
                targetChannel = fetchedChannel;
            }
        } catch {
            targetChannel = null;
        }
    }

    if (!targetChannel || !('send' in targetChannel)) {
        return void ctx.interaction.reply({ 
            content: '❌ **Ошибка:** Указанный канал не найден или в него нельзя отправлять сообщения.', 
            ephemeral: true 
        });
    }

    const embed = new EmbedBuilder()
        .setTitle('🎖️ Синхронизация профиля War Spectra')
        .setDescription(
            'Добро пожаловать! Для получения ролей отряда, званий и допусков на сервере необходимо привязать ваш **Discord** к игровому аккаунту.\n\n' +
            '### 📌 Инструкция:\n' +
            '1️⃣ Нажмите кнопку **«Привязать аккаунт»** и введите ваш **SteamID64** (или игровой pUID).\n' +
            '2️⃣ Нажмите **«Синхронизировать роли»**, если ваши данные на сервере/в БД обновились (например, при получении нового звания или смене отряда).\n\n' +
            '🔍 **Не знаете свой SteamID64?**\n' +
            'Вы можете узнать его на сайте: [SteamID.pro](https://steamid.pro/ru/) или [SteamID.io](https://steamid.io/)'
        )
        .setColor('#2b2d31')
        .setFooter({ text: 'War Spectra Bot • Code by DRuiD' })
        .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('btn_link_steam')
            .setLabel('Привязать аккаунт')
            .setEmoji('🔗')
            .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
            .setCustomId('btn_sync_roles')
            .setLabel('Синхронизировать роли')
            .setEmoji('🔄')
            .setStyle(ButtonStyle.Success)
    );

    try {
        await targetChannel.send({ embeds: [embed], components: [row] });
        return void ctx.interaction.reply({ 
            content: `✅ Панель синхронизации успешно отправлена в канал <#${targetChannel.id}>!`, 
            ephemeral: true 
        });
    } catch (err) {
        return void ctx.interaction.reply({ 
            content: `❌ Не удалось отправить панель в канал: ${err}`, 
            ephemeral: true 
        });
    }
};