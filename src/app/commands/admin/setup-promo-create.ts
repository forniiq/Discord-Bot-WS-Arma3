import { SERVER_CONFIG } from '@/config/server.config';
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
    guilds: SERVER_CONFIG.discord.guildId ? [SERVER_CONFIG.discord.guildId] : undefined
};

export const command: CommandData = {
    name: 'setup-promo-create',
    description: '📢 Отправить панель управления промокодами',
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
        .setTitle('🔥 ЦЕНТР УПРАВЛЕНИЯ ПРОМОКОДАМИ')
        .setDescription(
            'Добро пожаловать в панель администратора.\n\n' +
            '• Нажмите **«Создать промокод»**, чтобы добавить новый код.\n' +
            '• Нажмите **«Список промокодов»**, чтобы просмотреть активные коды и их статистику.'
        )
        .setColor('#10b981')
        .setFooter({ text: 'War Spectra Bot • Code by DRuiD' })
        .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('btn_create_promo')
            .setLabel('Создать промокод')
            .setEmoji('🗝️')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('btn_list_promo')
            .setLabel('Список промокодов')
            .setEmoji('📋')
            .setStyle(ButtonStyle.Primary)
    );

    try {
        await targetChannel.send({ embeds: [embed], components: [row] });
        return void ctx.interaction.reply({ 
            content: `✅ Панель управления успешно отправлена в канал <#${targetChannel.id}>!`, 
            ephemeral: true 
        });
    } catch (err) {
        return void ctx.interaction.reply({ 
            content: `❌ Не удалось отправить панель в канал: ${err}`, 
            ephemeral: true 
        });
    }
};