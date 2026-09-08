import {
    Interaction,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    EmbedBuilder,
    PermissionsBitField,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} from 'discord.js';

import {
    getAllPromocodes,
    getPromocode,
    deletePromocode
} from '../../../database/queries/promo.queries';

import { requireOperator } from '@/utils/operator.utils';

export default async function (interaction: Interaction) {
    // SELECT: УПРАВЛЕНИЕ ПРОМОКОДОМ
    if (
        interaction.isStringSelectMenu() &&
        interaction.customId === 'select_promo_manage'
    ) {
        try {
            await interaction.deferReply({
                flags: MessageFlags.Ephemeral
            });

            const selectedName = interaction.values[0];

            if (!selectedName) {
                return void await interaction.editReply({
                    content: '❌ Промокод не выбран.'
                });
            }

            const promo = await getPromocode(selectedName);

            if (!promo) {
                return void await interaction.editReply({
                    content: '❌ Промокод не найден.'
                });
            }

            let activationsCount = 0;

            if (promo.UsedUsers) {
                try {
                    activationsCount =
                        JSON.parse(promo.UsedUsers).length;
                } catch {
                    activationsCount = 0;
                }
            }

            let expireStr = '♾️ Бессрочно';

            if (promo.ExpiresAt) {
                const expDate = new Date(promo.ExpiresAt);
                const timestamp =
                    Math.floor(expDate.getTime() / 1000);

                expireStr =
                    `<t:${timestamp}:F> (<t:${timestamp}:R>)`;
            }

            const embed = new EmbedBuilder()
                .setTitle(`⚙️ Управление промокодом: ${promo.Name}`)
                .setColor('#3b82f6')
                .addFields(
                    {
                        name: '🗝️ Название',
                        value: `\`${promo.Name}\``,
                        inline: true
                    },
                    {
                        name: '⭐ Награда',
                        value: `+${promo.PromoEXP} EXP`,
                        inline: true
                    },
                    {
                        name: '👥 Доступно активаций',
                        value: `${promo.PromoActiv}`,
                        inline: true
                    },
                    {
                        name: '📊 Успешно использовали',
                        value: `${activationsCount} чел.`,
                        inline: true
                    },
                    {
                        name: '⏳ Срок действия',
                        value: expireStr,
                        inline: false
                    }
                )
                .setTimestamp();

            const actionRow =
                new ActionRowBuilder<ButtonBuilder>().addComponents(

                    new ButtonBuilder()
                        .setCustomId(
                            `btn_edit_promo:${promo.Name}`
                        )
                        .setLabel('Редактировать')
                        .setEmoji('✏️')
                        .setStyle(ButtonStyle.Primary),

                    new ButtonBuilder()
                        .setCustomId(
                            `btn_delete_promo:${promo.Name}`
                        )
                        .setLabel('Удалить')
                        .setEmoji('🗑️')
                        .setStyle(ButtonStyle.Danger)
                );

            return void await interaction.editReply({
                embeds: [embed],
                components: [actionRow]
            });

        } catch (error) {
            console.error(
                '[PromoButtons] Ошибка select_promo_manage:',
                error
            );
        }

        return;
    }

    // Всё ниже работает только с кнопками
    if (!interaction.isButton()) return;

    // СОЗДАНИЕ ПРОМОКОДА
    if (interaction.customId === 'btn_create_promo') {

        // Проверяем оператора ДО открытия админского Modal
        const isOperator = await requireOperator(
            interaction.user.id
        ).catch(() => false);

        if (!isOperator) {
            return void await interaction.reply({
                content: '❌ У вас нет доступа к этому действию.',
                flags: MessageFlags.Ephemeral
            }).catch(() => {});
        }

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
            .setPlaceholder('31.12.2026 23:59')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

        modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>()
                .addComponents(nameInput),

            new ActionRowBuilder<TextInputBuilder>()
                .addComponents(expInput),

            new ActionRowBuilder<TextInputBuilder>()
                .addComponents(activInput),

            new ActionRowBuilder<TextInputBuilder>()
                .addComponents(expiresInput)
        );

        return void await interaction.showModal(modal);
    }

    // СПИСОК ПРОМОКОДОВ
    if (interaction.customId === 'btn_list_promo') {

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

            const promos = await getAllPromocodes();

            if (promos.length === 0) {
                return void await interaction.editReply({
                    content: '📜 В базе данных пока нет промокодов.'
                });
            }

            const selectMenu =
                new StringSelectMenuBuilder()
                    .setCustomId('select_promo_manage')
                    .setPlaceholder(
                        'Выберите промокод для управления...'
                    );

            for (const promo of promos.slice(0, 25)) {
                selectMenu.addOptions({
                    label: promo.Name,
                    description:
                        `+${promo.PromoEXP} EXP | Ост: ${promo.PromoActiv}`,
                    value: promo.Name,
                    emoji: '🗝️'
                });
            }

            const row =
                new ActionRowBuilder<StringSelectMenuBuilder>()
                    .addComponents(selectMenu);

            return void await interaction.editReply({
                content:
                    '📋 **Выберите промокод из списка ниже для редактирования или удаления:**',
                components: [row]
            });

        } catch (error) {
            console.error(
                '[PromoButtons] Ошибка списка промокодов:',
                error
            );
        }

        return;
    }

    // РЕДАКТИРОВАНИЕ ПРОМОКОДА
    if (
        interaction.customId.startsWith('btn_edit_promo:')
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
            const promoName =
                interaction.customId.split(':')[1] ?? '';

            const promo = await getPromocode(promoName);

            if (!promo) {
                return void await interaction.reply({
                    content: '❌ Промокод не найден.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const modal = new ModalBuilder()
                .setCustomId(
                    `modal_edit_promo:${promo.Name}`
                )
                .setTitle(
                    `Редактирование: ${promo.Name}`
                );

            const expInput = new TextInputBuilder()
                .setCustomId('promo_exp')
                .setLabel('Количество EXP')
                .setValue(String(promo.PromoEXP))
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const activInput = new TextInputBuilder()
                .setCustomId('promo_activations')
                .setLabel('Максимум активаций')
                .setValue(String(promo.PromoActiv))
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            let dateFormatted = '';

            if (promo.ExpiresAt) {
                const d = new Date(promo.ExpiresAt);

                const pad = (n: number) =>
                    String(n).padStart(2, '0');

                dateFormatted =
                    `${pad(d.getDate())}.` +
                    `${pad(d.getMonth() + 1)}.` +
                    `${d.getFullYear()} ` +
                    `${pad(d.getHours())}:` +
                    `${pad(d.getMinutes())}`;
            }

            const expiresInput = new TextInputBuilder()
                .setCustomId('promo_expires')
                .setLabel(
                    'Дата окончания (ДД.ММ.ГГГГ ЧЧ:ММ) или пусто'
                )
                .setValue(dateFormatted)
                .setPlaceholder('31.12.2026 23:59')
                .setStyle(TextInputStyle.Short)
                .setRequired(false);

            modal.addComponents(
                new ActionRowBuilder<TextInputBuilder>()
                    .addComponents(expInput),

                new ActionRowBuilder<TextInputBuilder>()
                    .addComponents(activInput),

                new ActionRowBuilder<TextInputBuilder>()
                    .addComponents(expiresInput)
            );

            return void await interaction.showModal(modal);

        } catch (error) {
            console.error(
                '[PromoButtons] Ошибка редактирования:',
                error
            );

            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Не удалось открыть редактор промокода.',
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
            }
        }

        return;
    }

    // УДАЛЕНИЕ ПРОМОКОДА
    if (
        interaction.customId.startsWith('btn_delete_promo:')
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
            const promoName =
                interaction.customId.split(':')[1] ?? '';

            const deleted =
                await deletePromocode(promoName);

            if (deleted) {
                return void await interaction.reply({
                    content:
                        `✅ Промокод **${promoName}** успешно удалён из базы данных!`,
                    flags: MessageFlags.Ephemeral
                });
            }

            return void await interaction.reply({
                content:
                    `❌ Ошибка при удалении промокода **${promoName}**.`,
                flags: MessageFlags.Ephemeral
            });

        } catch (error) {
            console.error(
                '[PromoButtons] Ошибка удаления промокода:',
                error
            );

            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Произошла ошибка при удалении промокода.',
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
            }
        }

        return;
    }

    // ВВОД ПРОМОКОДА ИГРОКОМ
    if (interaction.customId === 'btn_open_promo') {

        // НИКАКОЙ requireOperator ЗДЕСЬ НЕТ

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
            new ActionRowBuilder<TextInputBuilder>()
                .addComponents(codeInput)
        );

        return void await interaction.showModal(modal);
    }
}