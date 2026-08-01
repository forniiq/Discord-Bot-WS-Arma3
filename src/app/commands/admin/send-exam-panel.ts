import type { ChatInputCommand, CommandData, CommandMetadata } from 'commandkit';
import { 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder, 
    PermissionFlagsBits,
    TextChannel
} from 'discord.js';

export const metadata: CommandMetadata = {
    userPermissions: 'Administrator',
    guilds: [process.env.GUILD_ID as string],
};

export const command: CommandData = {
    name: 'send-exam-panel',
    description: 'Отправить панель оплаты экзаменов в текущий канал',
    default_member_permissions: PermissionFlagsBits.Administrator.toString(),
};

export const chatInput: ChatInputCommand = async (ctx) => {
    const channel = ctx.interaction.channel;

    // Проверяем, можно ли отправлять сообщения в этот канал
    if (!channel || !channel.isSendable()) {
        await ctx.interaction.reply({
            content: '❌ Нельзя отправить панель в этот тип канала.',
            ephemeral: true,
        });
        return;
    }

    const embed = new EmbedBuilder()
        .setTitle('🎓 Система оплаты экзаменов и допусков')
        .setDescription(
            'Нажмите на кнопку ниже, чтобы перевести опыт инструктору за пройденный экзамен.\n\n' +
            '⚠️ **Внимание:** 20% комиссии автоматически уходит в Банк сервера.'
        )
        .setColor('#2b2d31');

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('start_exam_pay')
            .setLabel('Оплатить экзамен')
            .setEmoji('💳')
            .setStyle(ButtonStyle.Success)
    );

    await channel.send({ embeds: [embed], components: [row] });
    await ctx.interaction.reply({ content: 'Панель успешно отправлена!', ephemeral: true });
};