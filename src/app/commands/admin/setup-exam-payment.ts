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
    guilds: process.env.GUILD_ID ? [process.env.GUILD_ID] : undefined
};

export const command: CommandData = {
    name: 'setup-exam-payment',
    description: '📢 Отправить панель оплаты экзаменов и допусков',
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
        .setTitle('📚 Оплата экзаменов и допусков')
        .setColor('#2b2d31')
        .setDescription(
            'Нажмите на кнопку ниже, чтобы начать процедуру оплаты проведенного экзамена.\n\n' +
            '⚠️ **Внимание:** В случае нехватки текущего опыта у вас будет понижено звание!'
        )
        .setFooter({ text: 'War Spectra Bot • Code by DRuiD' })
        .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('btn_start_exam_pay')
            .setLabel('💳 Оплатить экзамен')
            .setStyle(ButtonStyle.Success)
    );

    try {
        await targetChannel.send({ embeds: [embed], components: [row] });
        return void ctx.interaction.reply({ 
            content: `✅ Панель оплаты экзаменов успешно отправлена в канал <#${targetChannel.id}>!`, 
            ephemeral: true 
        });
    } catch (err) {
        return void ctx.interaction.reply({ 
            content: `❌ Не удалось отправить панель в канал: ${err}`, 
            ephemeral: true 
        });
    }
};