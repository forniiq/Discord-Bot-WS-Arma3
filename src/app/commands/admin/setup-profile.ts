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
    name: 'setup-profile',
    description: '📢 Отправить панель вызова личного профиля бойца',
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
        .setTitle('🛡️ ПЕРСОНАЛЬНЫЙ ТЕРМИНАЛ WAR SPECTRA')
        .setDescription(
            'Добро пожаловать в центр управления данными бойца.\n\n' +
            'Нажмите на кнопку ниже, чтобы открыть ваш засекреченный **военный билет**, проверить текущие звания, допуски, опыт и статус синхронизации ролей в Discord.\n\n' +
            '> *ℹ️ Информация выводится в реальном времени напрямую из боевой базы данных сервера.*'
        )
        .setColor('#10b981') // Насыщенный тактический зеленый
        .setFooter({ text: 'War Spectra' })
        .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('btn_open_profile')
            .setLabel('Открыть мой профиль')
            .setEmoji('🪖')
            .setStyle(ButtonStyle.Success)
    );

    try {
        await targetChannel.send({ embeds: [embed], components: [row] });
        return void ctx.interaction.reply({ 
            content: `✅ Панель профиля успешно отправлена в канал <#${targetChannel.id}>!`, 
            ephemeral: true 
        });
    } catch (err) {
        return void ctx.interaction.reply({ 
            content: `❌ Не удалось отправить панель в канал: ${err}`, 
            ephemeral: true 
        });
    }
};