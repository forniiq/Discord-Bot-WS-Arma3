import {
    Interaction,
    EmbedBuilder,
    MessageFlags
} from 'discord.js';

import {
    createPromocode,
    updatePromocode,
    redeemPromocode
} from '../../../database/queries/promo.queries';

import { requireOperator } from '@/utils/operator.utils';

export default async function (interaction: Interaction) {
    if (!interaction.isModalSubmit()) return;

    // СОЗДАНИЕ ПРОМОКОДА
    if (interaction.customId === 'modal_create_promo') {

        const isOperator = await requireOperator(
            interaction.user.id
        ).catch(() => false);

        if (!isOperator) {
            return void await interaction.reply({
                content: '❌ У вас нет доступа к этому действию.',
                flags: MessageFlags.Ephemeral
            }).catch(() => {});
        }

        try {
            // Теперь interaction подтверждена
            await interaction.deferReply({
                flags: MessageFlags.Ephemeral
            });

            const name =
                interaction.fields
                    .getTextInputValue('promo_name')
                    .trim();

            const exp =
                parseFloat(
                    interaction.fields
                        .getTextInputValue('promo_exp')
                );

            const activations =
                parseInt(
                    interaction.fields
                        .getTextInputValue('promo_activations'),
                    10
                );

            const expiresRaw =
                interaction.fields
                    .getTextInputValue('promo_expires')
                    .trim();

            if (
                isNaN(exp) ||
                isNaN(activations) ||
                exp <= 0 ||
                activations < 0
            ) {
                return void await interaction.editReply({
                    content:
                        '❌ **Ошибка:** Опыт и количество активаций должны быть корректными положительными числами.'
                });
            }

            let expiresAt: Date | null = null;

            if (expiresRaw.length > 0) {

                const match = expiresRaw.match(
                    /^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})$/
                );

                if (!match) {
                    return void await interaction.editReply({
                        content:
                            '❌ **Ошибка:** Неверный формат даты! Используйте `ДД.ММ.ГГГГ ЧЧ:ММ` или оставьте поле пустым.'
                    });
                }

                const [
                    ,
                    day,
                    month,
                    year,
                    hours,
                    minutes
                ] = match;

                expiresAt = new Date(
                    `${year}-${month}-${day}T${hours}:${minutes}:00`
                );

                if (isNaN(expiresAt.getTime())) {
                    return void await interaction.editReply({
                        content:
                            '❌ **Ошибка:** Указана недействительная дата.'
                    });
                }
            }

            const success =
                await createPromocode(
                    name,
                    exp,
                    activations,
                    expiresAt
                );

            if (!success) {
                return void await interaction.editReply({
                    content:
                        '❌ Не удалось сохранить промокод в базе данных.'
                });
            }

            const embed = new EmbedBuilder()
                .setTitle('✅ Промокод успешно создан')
                .setColor('#10b981')
                .addFields(
                    {
                        name: '🗝️ Код',
                        value: `\`${name}\``,
                        inline: true
                    },
                    {
                        name: '⭐ EXP',
                        value: `+${exp}`,
                        inline: true
                    },
                    {
                        name: '👥 Активаций',
                        value: `${activations}`,
                        inline: true
                    },
                    {
                        name: '⏳ Срок действия',
                        value: expiresAt
                            ? `<t:${Math.floor(
                                expiresAt.getTime() / 1000
                                )}:F>`
                            : '♾️ Бессрочно',
                        inline: false
                    }
                );

            return void await interaction.editReply({
                embeds: [embed]
            });

        } catch (error) {
            console.error(
                '[PromoModals] Ошибка создания промокода:',
                error
            );

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    content: '❌ Произошла ошибка при создании промокода.'
                }).catch(() => {});
            }
        }

        return;
    }

    // РЕДАКТИРОВАНИЕ ПРОМОКОДА
    if (
        interaction.customId.startsWith('modal_edit_promo:')
    ) {

        const isOperator = await requireOperator(
            interaction.user.id
        ).catch(() => false);

        if (!isOperator) {
            return void await interaction.reply({
                content: '❌ У вас нет доступа к этому действию.',
                flags: MessageFlags.Ephemeral
            }).catch(() => {});
        }

        try {
            await interaction.deferReply({
                flags: MessageFlags.Ephemeral
            });

            const name =
                interaction.customId.split(':')[1] ?? '';

            const exp =
                parseFloat(
                    interaction.fields
                        .getTextInputValue('promo_exp')
                );

            const activations =
                parseInt(
                    interaction.fields
                        .getTextInputValue('promo_activations'),
                    10
                );

            const expiresRaw =
                interaction.fields
                    .getTextInputValue('promo_expires')
                    .trim();

            if (
                isNaN(exp) ||
                isNaN(activations) ||
                exp <= 0 ||
                activations < 0
            ) {
                return void await interaction.editReply({
                    content:
                        '❌ **Ошибка:** Опыт и количество активаций должны быть корректными положительными числами.'
                });
            }

            let expiresAt: Date | null = null;

            if (expiresRaw.length > 0) {

                const match = expiresRaw.match(
                    /^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})$/
                );

                if (!match) {
                    return void await interaction.editReply({
                        content:
                            '❌ **Ошибка:** Неверный формат даты! Используйте `ДД.ММ.ГГГГ ЧЧ:ММ` или оставьте поле пустым.'
                    });
                }

                const [
                    ,
                    day,
                    month,
                    year,
                    hours,
                    minutes
                ] = match;

                expiresAt = new Date(
                    `${year}-${month}-${day}T${hours}:${minutes}:00`
                );

                if (isNaN(expiresAt.getTime())) {
                    return void await interaction.editReply({
                        content:
                            '❌ **Ошибка:** Указана недействительная дата.'
                    });
                }
            }

            const success =
                await updatePromocode(
                    name,
                    exp,
                    activations,
                    expiresAt
                );

            if (!success) {
                return void await interaction.editReply({
                    content:
                        '❌ Не удалось обновить данные промокода.'
                });
            }

            const embed = new EmbedBuilder()
                .setTitle('✏️ Промокод обновлен')
                .setColor('#3b82f6')
                .addFields(
                    {
                        name: '🗝️ Код',
                        value: `\`${name}\``,
                        inline: true
                    },
                    {
                        name: '⭐ EXP',
                        value: `+${exp}`,
                        inline: true
                    },
                    {
                        name: '👥 Осталось активаций',
                        value: `${activations}`,
                        inline: true
                    },
                    {
                        name: '⏳ Срок действия',
                        value: expiresAt
                            ? `<t:${Math.floor(
                                expiresAt.getTime() / 1000
                                )}:F>`
                            : '♾️ Бессрочно',
                        inline: false
                    }
                );

            return void await interaction.editReply({
                embeds: [embed]
            });

        } catch (error) {
            console.error(
                '[PromoModals] Ошибка редактирования промокода:',
                error
            );

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    content:
                        '❌ Произошла ошибка при редактировании промокода.'
                }).catch(() => {});
            }
        }

        return;
    }

    // АКТИВАЦИЯ ПРОМОКОДА ИГРОКОМ
    if (interaction.customId === 'modal_use_promo') {

        try {
            // НИКАКОЙ requireOperator ЗДЕСЬ НЕТ

            await interaction.deferReply({
                flags: MessageFlags.Ephemeral
            });

            const code =
                interaction.fields
                    .getTextInputValue('promo_code')
                    .trim();

            const result =
                await redeemPromocode(
                    interaction.user.id,
                    code
                );

            if (!result.success) {

                switch (result.error) {

                    case 'NOT_FOUND':
                        return void await interaction.editReply({
                            content:
                                '❌ **Ошибка:** Указанный промокод не существует.'
                        });

                    case 'INACTIVE':
                        return void await interaction.editReply({
                            content:
                                '❌ **Ошибка:** Данный промокод больше не активен или лимит его использования исчерпан.'
                        });

                    case 'EXPIRED':
                        return void await interaction.editReply({
                            content:
                                '❌ **Ошибка:** Срок действия этого промокода истёк!'
                        });

                    case 'ALREADY_USED':
                        return void await interaction.editReply({
                            content:
                                '❌ **Ошибка:** Вы уже активировали этот промокод ранее!'
                        });

                    case 'PLAYER_NOT_FOUND':
                        return void await interaction.editReply({
                            content:
                                '❌ **Ошибка:** Ваш профиль не найден в базе данных игроков.'
                        });

                    default:
                        return void await interaction.editReply({
                            content:
                                '❌ Произошла ошибка при обработке БД.'
                        });
                }
            }

            const embed = new EmbedBuilder()
                .setTitle('🎉 Промокод успешно активирован!')
                .setColor('#10b981')
                .setDescription(
                    `Вы успешно использовали промокод **${code}**!`
                )
                .addFields(
                    {
                        name: '🎁 Получено EXP',
                        value: `\`+${result.gainedExp}\``,
                        inline: true
                    },
                    {
                        name: '📊 Новый уровень',
                        value: `\`${result.newLvl}\``,
                        inline: true
                    },
                    {
                        name: '✨ Новый опыт',
                        value: `\`${result.newExp}\``,
                        inline: true
                    }
                );

            if (result.rankChanged) {
                embed.setFooter({
                    text:
                        '🎖️ Поздравляем! Ваш ранг был повышен!'
                });
            }

            return void await interaction.editReply({
                embeds: [embed]
            });

        } catch (error) {
            console.error(
                '[PromoModals] Ошибка активации промокода:',
                error
            );

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    content:
                        '❌ Не удалось активировать промокод.'
                }).catch(() => {});
            }
        }

        return;
    }
}