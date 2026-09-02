import { Interaction, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, PermissionsBitField } from 'discord.js';
import { getAllPromocodes } from '../../../database/queries/promo.queries';

export default async function (interaction: Interaction) {
    if (!interaction.isButton()) return;

    // 1. Окно создания промокода (для админов)
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

        const expiresInput = new TextInputBuilder()
            .setCustomId('promo_expires')
            .setLabel('Дата окончания (ДД.ММ.ГГГГ ЧЧ:ММ) или пусто')
            .setPlaceholder('Например: 31.12.2026 23:59 (пусто = бессрочно)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

        modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(expInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(activInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(expiresInput)
        );

        return await interaction.showModal(modal);
    }

    // 2. Просмотр списка промокодов (для админов)
    if (interaction.customId === 'btn_list_promo') {
        if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
            return void interaction.reply({ content: '❌ У вас нет прав на просмотр списка промокодов.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const promos = await getAllPromocodes();

        if (promos.length === 0) {
            return void interaction.editReply({ content: '📜 В базе данных пока нет промокодов.' });
        }

        const embed = new EmbedBuilder()
            .setTitle('📋 Список текущих промокодов')
            .setColor('#10b981')
            .setTimestamp();

        for (const promo of promos) {
            let activationsCount = 0;
            if (promo.UsedUsers) {
                try {
                    activationsCount = JSON.parse(promo.UsedUsers).length;
                } catch {
                    activationsCount = 0;
                }
            }

            let expireStr = '♾️ Бессрочно';
            if (promo.ExpiresAt) {
                const expDate = new Date(promo.ExpiresAt);
                const timestamp = Math.floor(expDate.getTime() / 1000);
                expireStr = `<t:${timestamp}:F> (<t:${timestamp}:R>)`;
            }

            embed.addFields({
                name: `🗝️ ${promo.Name}`,
                value: `• **Опыт:** +${promo.PromoEXP} EXP\n` +
                       `• **Осталось активаций:** ${promo.PromoActiv}\n` +
                       `• **Уже использовали:** ${activationsCount} чел.\n` +
                       `• **Срок действия:** ${expireStr}`,
                inline: false
            });
        }

        return void interaction.editReply({ embeds: [embed] });
    }

    // 3. Окно ввода промокода (для игроков)
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