import { Interaction, EmbedBuilder, PermissionsBitField } from 'discord.js';
import { createPromocode, updatePromocode, redeemPromocode } from '../../../database/queries/promo.queries';

export default async function (interaction: Interaction) {
    if (!interaction.isModalSubmit()) return;

    // 1. ОБРАБОТКА СОЗДАНИЯ ПРОМОКОДА
    if (interaction.customId === 'modal_create_promo') {
        if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
            return void interaction.reply({ content: '❌ У вас нет прав на создание промокодов.', ephemeral: true });
        }

        const name = interaction.fields.getTextInputValue('promo_name').trim();
        const exp = parseFloat(interaction.fields.getTextInputValue('promo_exp'));
        const activations = parseInt(interaction.fields.getTextInputValue('promo_activations'), 10);
        const expiresRaw = interaction.fields.getTextInputValue('promo_expires').trim();

        if (isNaN(exp) || isNaN(activations) || exp <= 0 || activations < 0) {
            return void interaction.reply({ 
                content: '❌ **Ошибка:** Опыт и количество активаций должны быть корректными положительными числами.', 
                ephemeral: true 
            });
        }

        let expiresAt: Date | null = null;
        if (expiresRaw.length > 0) {
            const match = expiresRaw.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})$/);
            if (!match) {
                return void interaction.reply({
                    content: '❌ **Ошибка:** Неверный формат даты! Используйте формат `ДД.ММ.ГГГГ ЧЧ:ММ` (например: `31.12.2026 23:59`) или оставьте поле пустым.',
                    ephemeral: true
                });
            }

            const [, day, month, year, hours, minutes] = match;
            expiresAt = new Date(`${year}-${month}-${day}T${hours}:${minutes}:00`);

            if (isNaN(expiresAt.getTime())) {
                return void interaction.reply({ content: '❌ **Ошибка:** Указана недействительная дата.', ephemeral: true });
            }
        }

        const success = await createPromocode(name, exp, activations, expiresAt);
        if (success) {
            const embed = new EmbedBuilder()
                .setTitle('✅ Промокод успешно создан')
                .setColor('#10b981')
                .addFields(
                    { name: '🗝️ Код', value: `\`${name}\``, inline: true },
                    { name: '⭐ EXP', value: `+${exp}`, inline: true },
                    { name: '👥 Активаций', value: `${activations}`, inline: true },
                    { 
                        name: '⏳ Срок действия', 
                        value: expiresAt ? `<t:${Math.floor(expiresAt.getTime() / 1000)}:F>` : '♾️ Бессрочно', 
                        inline: false 
                    }
                );
            return void interaction.reply({ embeds: [embed], ephemeral: true });
        } else {
            return void interaction.reply({ content: '❌ Не удалось сохранить промокод в базе данных.', ephemeral: true });
        }
    }

    // 2. ОБРАБОТКА РЕДАКТИРОВАНИЯ ПРОМОКОДА
    if (interaction.customId.startsWith('modal_edit_promo:')) {
        if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
            return void interaction.reply({ content: '❌ У вас нет прав на редактирование промокодов.', ephemeral: true });
        }

        // Оператор ?? '' защищает от типа undefined (TS2345)
        const name = interaction.customId.split(':')[1] ?? '';
        const exp = parseFloat(interaction.fields.getTextInputValue('promo_exp'));
        const activations = parseInt(interaction.fields.getTextInputValue('promo_activations'), 10);
        const expiresRaw = interaction.fields.getTextInputValue('promo_expires').trim();

        if (isNaN(exp) || isNaN(activations) || exp <= 0 || activations < 0) {
            return void interaction.reply({ 
                content: '❌ **Ошибка:** Опыт и количество активаций должны быть корректными положительными числами.', 
                ephemeral: true 
            });
        }

        let expiresAt: Date | null = null;
        if (expiresRaw.length > 0) {
            const match = expiresRaw.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})$/);
            if (!match) {
                return void interaction.reply({
                    content: '❌ **Ошибка:** Неверный формат даты! Используйте `ДД.ММ.ГГГГ ЧЧ:ММ` или оставьте пустым.',
                    ephemeral: true
                });
            }

            const [, day, month, year, hours, minutes] = match;
            expiresAt = new Date(`${year}-${month}-${day}T${hours}:${minutes}:00`);

            if (isNaN(expiresAt.getTime())) {
                return void interaction.reply({ content: '❌ **Ошибка:** Указана недействительная дата.', ephemeral: true });
            }
        }

        const success = await updatePromocode(name, exp, activations, expiresAt);
        if (success) {
            const embed = new EmbedBuilder()
                .setTitle('✏️ Промокод обновлен')
                .setColor('#3b82f6')
                .addFields(
                    { name: '🗝️ Код', value: `\`${name}\``, inline: true },
                    { name: '⭐ EXP', value: `+${exp}`, inline: true },
                    { name: '👥 Осталось активаций', value: `${activations}`, inline: true },
                    { 
                        name: '⏳ Срок действия', 
                        value: expiresAt ? `<t:${Math.floor(expiresAt.getTime() / 1000)}:F>` : '♾️ Бессрочно', 
                        inline: false 
                    }
                );
            return void interaction.reply({ embeds: [embed], ephemeral: true });
        } else {
            return void interaction.reply({ content: '❌ Не удалось обновить данные промокода.', ephemeral: true });
        }
    }

    // 3. ОБРАБОТКА АКТИВАЦИИ ПРОМОКОДА (ИГРОКИ)
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
                case 'EXPIRED':
                    return void interaction.editReply({ content: '❌ **Ошибка:** Срок действия этого промокода истёк!' });
                case 'ALREADY_USED':
                    return void interaction.editReply({ content: '❌ **Ошибка:** Вы уже активировали этот промокод ранее!' });
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