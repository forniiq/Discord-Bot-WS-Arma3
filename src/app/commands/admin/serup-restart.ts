import { 
    ChatInputCommandInteraction, 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ChannelType,
    PermissionFlagsBits
} from 'discord.js';
import { sendLog } from '@/utils/logger.utils';

export const data = new SlashCommandBuilder()
    .setName('setup-restart')
    .setDescription('⚙️ Развернуть панель управления рестартом серверов Arma 3')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(option =>
        option
            .setName('channel')
            .setDescription('Канал для установки панели (по умолчанию — текущий)')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(false)
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

    if (!targetChannel || !('send' in targetChannel)) {
        return void interaction.reply({
            content: '❌ **Ошибка:** Указанный канал не найден или в него нельзя отправлять сообщения.',
            ephemeral: true
        });
    }

    const embed = new EmbedBuilder()
        .setTitle('⚡ Панель Управления Серверами Arma 3')
        .setDescription(
            'Нажмите на соответствующую кнопку ниже для перезагрузки нужного игрового сервера.\n\n' +
            '🟢 **PvE Server** — Altis Life / Co-op\n' +
            '🔴 **PvP Server** — Altis Warfare / TvT\n\n' +
            '⚠️ *Каждое действие требует подтверждения и фиксируется в логах!*'
        )
        .setColor('#2b2d31')
        .setFooter({ text: 'War Spectra Server Manager' })
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
        
        await sendLog('INFO', 'RestartPanel', `Администратор ${interaction.user.tag} отправил панель рестарта в канал <#${targetChannel.id}>`);

        return void interaction.reply({
            content: `✅ Панель управления успешно отправлена в канал <#${targetChannel.id}>!`,
            ephemeral: true
        });
    } catch (err) {
        return void interaction.reply({
            content: `❌ Не удалось отправить панель в канал: ${err}`,
            ephemeral: true
        });
    }
}