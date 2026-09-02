import type { ChatInputCommand, CommandData, CommandMetadata } from 'commandkit';
import { 
    ApplicationCommandOptionType, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder, 
    ChannelType 
} from 'discord.js';
import { sendLog } from '@/utils/logger.utils';

export const metadata: CommandMetadata = {
    userPermissions: 'Administrator',
    guilds: [process.env.GUILD_ID as string]
};

export const command: CommandData = {
    name: 'setup-restart',
    description: '⚙️ Отправить панель управления рестартом серверов Arma 3',
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
        .setTitle('⚡ ПАНЕЛЬ УПРАВЛЕНИЯ СЕРВЕРАМИ ARMA 3')
        .setDescription(
            'Нажмите на соответствующую кнопку ниже, чтобы запустить процедуру рестарта нужного сервера.\n\n' +
            '🟢 **PvE Server** — Altis Life / Co-op\n' +
            '🔴 **PvP Server** — Altis Warfare / TvT\n\n' +
            '⚠️ *Каждое действие требует подтверждения в интерактивном окне.*'
        )
        .setColor('#2b2d31')
        .setFooter({ text: 'War Spectra Bot • Code by DRuiD' })
        .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('btn_restart_pve')
            .setLabel('Рестарт PvE')
            .setEmoji('🛡️')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('btn_restart_pvp')
            .setLabel('Рестарт PvP')
            .setEmoji('⚔️')
            .setStyle(ButtonStyle.Danger)
    );

    try {
        await targetChannel.send({ embeds: [embed], components: [row] });
        
        await sendLog('INFO', 'RestartPanel', `Администратор ${ctx.interaction.user.tag} выставил панель рестарта в канал <#${targetChannel.id}>`);

        return void ctx.interaction.reply({ 
            content: `✅ Панель управления рестартами успешно отправлена в канал <#${targetChannel.id}>!`, 
            ephemeral: true 
        });
    } catch (err) {
        return void ctx.interaction.reply({ 
            content: `❌ Не удалось отправить панель в канал: ${err}`, 
            ephemeral: true 
        });
    }
};