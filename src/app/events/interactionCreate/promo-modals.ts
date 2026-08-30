import { Interaction, EmbedBuilder, PermissionsBitField } from 'discord.js';
import { createPromocode, redeemPromocode } from '../../../database/queries/promo.queries';

export default async function (interaction: Interaction) {
    if (!interaction.isModalSubmit()) return;

    // 1. Обработка создания промокода
    if (interaction.customId === 'modal_create_promo') {
        if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
            return void interaction.reply({ content: '❌ У вас нет прав на создание промокодов.', ephemeral: true });
        }

        const name = interaction.fields.getTextInputValue('promo_name').trim();
        const exp = parseFloat(interaction.fields.getTextInputValue('promo_exp'));
        const activations = parseInt(interaction.fields.getTextInputValue('promo_activations'), 10);

        if (isNaN(exp) || isNaN(activations) || exp <= 0 || activations < 0) {
            return void interaction.reply({ 
                content: '❌ **Ошибка:** Опыт и количество активаций должны быть корректными положительными числами.', 
                ephemeral: true 
            });
        }

        const success = await createPromocode(name, exp, activations);
        if (success) {
            const embed = new EmbedBuilder()
                .setTitle('✅ Промокод успешно создан')
                .setColor('#10b981')
                .addFields(
                    { name: '🗝️ Код', value: `\`${name}\``, inline: true },
                    { name: '⭐ EXP', value: `+${exp}`, inline: true },
                    { name: '👥 Активаций', value: `${activations}`, inline: true }
                );
            return void interaction.reply({ embeds: [embed], ephemeral: true });
        } else {
            return void interaction.reply({ content: '❌ Не удалось сохранить промокод в базе данных.', ephemeral: true });
        }
    }

    // 2. Обработка активации промокода
    if (interaction.customId === 'modal_use_promo') {
        const code = interaction.fields.getTextInputValue('promo_code').trim();

        await interaction.deferReply({ ephemeral: true });

        const result = await redeemPromocode(interaction.user.id, code);

        if (!result.success) {
            switch (result.error) {
                case 'NOT_FOUND':
                    return void interaction.editReply({ content: '❌ **Ошибка:** Указанный промокод не существует.' });
                case 'INACTIVE':
                    return void interaction.editReply({ content: '❌ **Ошибка:** Данный промокод больше не активен или лимит его использования исчерпан.' });
                case 'PLAYER_NOT_FOUND':
                    return void interaction.editReply({ content: '❌ **Ошибка:** Ваш профиль не найден в базе данных игроков.' });
                default:
                    return void interaction.editReply({ content: '❌ Произошла ошибка при обработке БД.' });
            }
        }

        const embed = new EmbedBuilder()
            .setTitle('🎉 Промокод успешно активирован!')
            .setColor('#10b981')
            .setDescription(`Вы успешно использовали промокод **${code}**!`)
            .addFields(
                { name: '🎁 Получено EXP', value: `\`+${result.gainedExp}\``, inline: true },
                { name: '📊 Новый уровень', value: `\`${result.newLvl}\``, inline: true },
                { name: '✨ Новый опыт', value: `\`${result.newExp}\``, inline: true }
            );

        if (result.rankChanged) {
            embed.setFooter({ text: '🎖️ Поздравляем! Ваш ранг был повышен!' });
        }

        return void interaction.editReply({ embeds: [embed] });
    }
}