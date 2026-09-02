import { Interaction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export default async function handleRestartButtons(interaction: Interaction) {
    if (!interaction.isButton()) return;

    // Первичное нажатие: Вызываем диалог подтверждения
    if (interaction.customId === 'btn_restart_pve' || interaction.customId === 'btn_restart_pvp') {
        const isPvE = interaction.customId === 'btn_restart_pve';
        const serverType = isPvE ? 'PvE' : 'PvP';

        const confirmEmbed = new EmbedBuilder()
            .setTitle('⚠️ Подтверждение действия')
            .setDescription(
                `Вы уверены, что хотите перезапустить **${serverType} сервер**?\n` +
                'Все текущие игроки будут отключены от сервера!'
            )
            .setColor('#fee75c');

        const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`confirm_restart_${isPvE ? 'pve' : 'pvp'}`)
                .setLabel(`Да, перезапустить ${serverType}`)
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('cancel_restart')
                .setLabel('Отмена')
                .setStyle(ButtonStyle.Secondary)
        );

        return void interaction.reply({
            embeds: [confirmEmbed],
            components: [confirmRow],
            ephemeral: true
        });
    }

    // Отмена операции
    if (interaction.customId === 'cancel_restart') {
        return void interaction.update({
            content: '❌ Операция перезапуска отменена.',
            embeds: [],
            components: []
        });
    }
}