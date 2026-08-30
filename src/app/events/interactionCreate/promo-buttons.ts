import { Interaction, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';

export default async function (interaction: Interaction) {
    if (!interaction.isButton()) return;

    // Окно создания промокода (для админов)
    if (interaction.customId === 'btn_create_promo') {
        const modal = new ModalBuilder()
            .setCustomId('modal_create_promo')
            .setTitle('Создание нового промокода');

        const nameInput = new TextInputBuilder()
            .setCustomId('promo_name')
            .setLabel('Название промокода')
            .setPlaceholder('Например: WarSpectra2026')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const expInput = new TextInputBuilder()
            .setCustomId('promo_exp')
            .setLabel('Количество EXP')
            .setPlaceholder('Например: 1000')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const activInput = new TextInputBuilder()
            .setCustomId('promo_activations')
            .setLabel('Максимум активаций')
            .setPlaceholder('Например: 50')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(expInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(activInput)
        );

        return await interaction.showModal(modal);
    }

    // Окно ввода промокода (для игроков)
    if (interaction.customId === 'btn_open_promo') {
        const modal = new ModalBuilder()
            .setCustomId('modal_use_promo')
            .setTitle('Активация промокода');

        const codeInput = new TextInputBuilder()
            .setCustomId('promo_code')
            .setLabel('Введите ваш промокод')
            .setPlaceholder('Например: WarSpectra2026')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(codeInput)
        );

        return await interaction.showModal(modal);
    }
}