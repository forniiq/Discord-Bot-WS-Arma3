import { 
    Interaction, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    UserSelectMenuBuilder,
    ChannelType
} from 'discord.js';
import { EXAM_DATA, ExamCategory, ExamItem } from '../../../config/exams';
import { processExamPayment, findPlayer } from '../../../database/queries';
import { sendAdminLog } from '../../../utils/logger';
import { updateBankDisplay } from '@/services/bankService';

const EXAMINERS_CHANNEL_ID = process.env.EXAMINERS_CHANNEL_ID as string;

export default async function (interaction: Interaction) {
    if (!interaction.isButton() || interaction.customId !== 'start_exam_pay') return;

    // Ищем игрока в БД, чтобы получить текущий баланс
    const studentData = await findPlayer({ discordId: interaction.user.id });

    if (!studentData) {
        return void interaction.reply({
            content: '❌ Ваш аккаунт Discord не привязан к игровой базе данных!',
            ephemeral: true
        });
    }

    // Состояния текущей сессии
    let selectedInstructorId: string | null = null;
    let selectedExam: ExamItem | null = null;
    let selectedCategoryId: string | null = null;

    // Функция отрисовки Шага 1 
    const renderStep1 = () => {
        const instructorSelect = new UserSelectMenuBuilder()
            .setCustomId('select_instructor')
            .setPlaceholder('Выберите инструктора, принявшего экзамен');

        const row = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(instructorSelect);

        return {
            content: `💳 **Ваш текущий баланс:** **${studentData.pExp}** EXP | Звание: **${studentData.pLvl}**\n\n👤 **Шаг 1 из 3:** Выберите инструктора из списка:`,
            embeds: [],
            components: [row],
        };
    };

    // Функция отрисовки Шага 2 (Выбор категории)
    const renderStep2 = () => {
        const categoryRows = createCategoryButtons();
        return {
            content: `💳 **Ваш баланс:** **${studentData.pExp}** EXP\n👤 Инструктор: <@${selectedInstructorId}>\n\n📂 **Шаг 2 из 3:** Выберите категорию экзамена:`,
            embeds: [],
            components: categoryRows,
        };
    };

    // Функция отрисовки Шага 2.5 (Выбор конкретного экзамена)
    const renderStep2Exams = (categoryId: string) => {
        const category = EXAM_DATA[categoryId];
        if (!category) return null;

        const examRows = createExamButtons(category.items);
        return {
            content: `💳 **Ваш баланс:** **${studentData.pExp}** EXP\n👤 Инструктор: <@${selectedInstructorId}>\n📋 Категория: **${category.label}**\n\nВыберите экзамен:`,
            embeds: [],
            components: examRows,
        };
    };

    // Инициализация интерфейса
    const response = await interaction.reply({
        ...renderStep1(),
        ephemeral: true,
        fetchReply: true,
    });

    const collector = response.createMessageComponentCollector({
        time: 120_000,
    });

    collector.on('collect', async (i) => {
        // Обработка кнопки "Назад"
        if (i.isButton() && i.customId.startsWith('back_to_')) {
            const target = i.customId.replace('back_to_', '');

            if (target === 'step1') {
                selectedInstructorId = null;
                selectedCategoryId = null;
                await i.update(renderStep1());
                return;
            }

            if (target === 'step2') {
                selectedCategoryId = null;
                selectedExam = null;
                await i.update(renderStep2());
                return;
            }
        }

        // 1: Выбор инструктора
        if (i.isUserSelectMenu() && i.customId === 'select_instructor') {
            const chosenId = i.values[0];

            if (!chosenId) {
                await i.reply({ content: '❌ Инструктор не выбран!', ephemeral: true });
                return;
            }

            if (chosenId === i.user.id) {
                await i.reply({ content: '❌ Вы не можете перевести опыт самому себе!', ephemeral: true });
                return;
            }

            const selectedUser = i.users.get(chosenId);
            if (selectedUser?.bot) {
                await i.reply({ content: '❌ Нельзя переводить опыт боту!', ephemeral: true });
                return;
            }

            selectedInstructorId = chosenId;
            await i.update(renderStep2());
        }

        // Кнопки выбора категорий и экзаменов
        if (i.isButton()) {
            // Выбор категории
            if (i.customId.startsWith('select_category_')) {
                selectedCategoryId = i.customId.replace('select_category_', '');
                const stepData = renderStep2Exams(selectedCategoryId);
                if (stepData) {
                    await i.update(stepData);
                }
            }

            // Выбор конкретного экзамена (Переход к шагу 3)
            if (i.customId.startsWith('exam_pick_')) {
                const examId = i.customId.replace('exam_pick_', '');
                selectedExam = findExamById(examId);

                if (selectedExam && selectedInstructorId) {
                    const instructorExp = Math.floor(selectedExam.cost * 0.8);
                    const bankExp = Math.ceil(selectedExam.cost * 0.2);

                    const confirmEmbed = new EmbedBuilder()
                        .setTitle('⚙️ Подтверждение перевода')
                        .setColor('#f1c40f')
                        .addFields(
                            { name: 'Курсант', value: `<@${i.user.id}> (Баланс: ${studentData.pExp} EXP)`, inline: false },
                            { name: 'Инструктор', value: `<@${selectedInstructorId}>`, inline: true },
                            { name: 'Экзамен', value: `${selectedExam.label}`, inline: true },
                            { name: 'Сумма списания', value: `**${selectedExam.cost}** EXP`, inline: true },
                            { name: 'Получит инструктор (80%)', value: `**${instructorExp}** EXP`, inline: true },
                            { name: 'Комиссия в банк (20%)', value: `**${bankExp}** EXP`, inline: true }
                        );

                    const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                        new ButtonBuilder()
                            .setCustomId('confirm_pay')
                            .setLabel('Подтвердить перевод')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId(`back_to_step2`)
                            .setLabel('⬅️ Назад к выбору')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('cancel_pay')
                            .setLabel('Отмена')
                            .setStyle(ButtonStyle.Danger)
                    );

                    await i.update({
                        content: '⚠️ **Шаг 3 из 3:** Проверьте детали перевода:',
                        embeds: [confirmEmbed],
                        components: [confirmRow],
                    });
                }
            }

            // Отмена
            if (i.customId === 'cancel_pay') {
                collector.stop('cancelled');
                await i.update({ content: '❌ Перевод отменен.', embeds: [], components: [] });
            }

            // Подтверждение оплаты
            if (i.customId === 'confirm_pay' && selectedInstructorId && selectedExam) {
                await i.deferUpdate();

                const result = await processExamPayment(
                    i.user.id,
                    selectedInstructorId,
                    selectedExam.cost
                );

                if (result.success) {
                    const instructorExp = Math.floor(selectedExam.cost * 0.8);
                    const bankExp = Math.ceil(selectedExam.cost * 0.2);

                    let rankNotice = '';
                    if (result.rankChanged) {
                        rankNotice = `\n\n⚠️ **Внимание:** В связи с недостатком опыта ваш ранг понижен: \`${result.oldRank}\` ➔ \`${result.newRank}\``;
                    }

                    const successEmbed = new EmbedBuilder()
                        .setTitle('✅ Оплата пройдена успешно!')
                        .setColor('#2ecc71')
                        .setDescription(
                            `Вы перевели **${selectedExam.cost} EXP** за экзамен **${selectedExam.label}**.\n\n` +
                            `• Инструктор <@${selectedInstructorId}> получил: **${instructorExp} EXP**\n` +
                            `• В банк отправлено: **${bankExp} EXP**\n` +
                            `• Ваш начальный баланс: **${result.studentInitialExp} EXP**\n` +
                            `• Ваш остаток: **${result.studentExpLeft} EXP**` +
                            rankNotice
                        );

                    await i.editReply({ content: '', embeds: [successEmbed], components: [] });
                    collector.stop('completed');

                    // 1. Отправка в канал экзаменаторов
                    try {
                        const examChannel = i.client.channels.cache.get(EXAMINERS_CHANNEL_ID) || 
                                            await i.client.channels.fetch(EXAMINERS_CHANNEL_ID).catch(() => null);

                        if (examChannel && examChannel.type === ChannelType.GuildText) {
                            const publicEmbed = new EmbedBuilder()
                                .setTitle('🎓 Подтверждение оплаты экзамена')
                                .setColor('#3498db')
                                .setDescription(
                                    `Курсант <@${i.user.id}> успешно оплатил экзамен **${selectedExam.label}**.\n` +
                                    `Инструктору <@${selectedInstructorId}> начислено **${instructorExp} EXP**.`
                                )
                                .addFields(
                                    { name: 'Сумма экзамена', value: `${selectedExam.cost} EXP`, inline: true },
                                    { name: 'Остаток у курсанта', value: `${result.studentExpLeft} EXP`, inline: true },
                                    ...(result.rankChanged ? [{ name: 'Изменение звания', value: `\`${result.oldRank}\` ➔ \`${result.newRank}\``, inline: false }] : [])
                                )
                                .setTimestamp();

                            await examChannel.send({
                                content: `🔔 Инструктор <@${selectedInstructorId}>, вам поступила оплата экзамена!`,
                                embeds: [publicEmbed]
                            });
                        }
                    } catch (err) {
                        console.error('Ошибка отправки в канал экзаменаторов:', err);
                    }

                    // 2. Логирование
                    await sendAdminLog({
                        title: '💳 Оплата экзамена',
                        description: `Курсант <@${i.user.id}> перевел опыт инструктору <@${selectedInstructorId}>.`,
                        color: '#2ecc71',
                        executorId: i.user.id,
                        fields: [
                            { name: 'Экзамен', value: selectedExam.label, inline: true },
                            { name: 'Стоимость', value: `${selectedExam.cost} EXP`, inline: true },
                            { name: 'Инструктор получил', value: `${instructorExp} EXP`, inline: true },
                            { name: 'В банк', value: `${bankExp} EXP`, inline: true },
                            { name: 'Баланс до/после', value: `${result.studentInitialExp} ➔ ${result.studentExpLeft} EXP`, inline: false },
                            ...(result.rankChanged ? [{ name: 'Понижение звания', value: `\`${result.oldRank}\` ➔ \`${result.newRank}\``, inline: false }] : [])
                        ]
                    });

                    updateBankDisplay(i.client);

                } else {
                    let errorMsg = '💥 Произошла непредвиденная ошибка.';
                    if (result.error === 'STUDENT_NOT_FOUND') {
                        errorMsg = '❌ Ваш профиль не найден в базе данных (не привязан Discord)!';
                    } else if (result.error === 'INSTRUCTOR_NOT_FOUND') {
                        errorMsg = '❌ Профиль инструктора не найден в базе данных (не привязан Discord)!';
                    } else if (result.error === 'NOT_ENOUGH_EXP') {
                        errorMsg = '❌ У вас недостаточно опыта даже при возможном понижении звания!';
                    }

                    await i.editReply({ content: errorMsg, embeds: [], components: [] });
                    collector.stop('error');
                }
            }
        }
    });

    collector.on('end', (_, reason) => {
        if (reason === 'time') {
            interaction.editReply({
                content: '⏱️ Время ожидания вышло. Попробуйте снова.',
                embeds: [],
                components: [],
            }).catch(() => {});
        }
    });
}

// Вспомогательные функции

function createCategoryButtons() {
    const row = new ActionRowBuilder<ButtonBuilder>();
    const categories = Object.values(EXAM_DATA) as ExamCategory[];

    categories.forEach((cat: ExamCategory) => {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`select_category_${cat.id}`)
                .setLabel(cat.label)
                .setStyle(ButtonStyle.Primary)
        );
    });

    // Кнопка возврата к выбору инструктора
    row.addComponents(
        new ButtonBuilder()
            .setCustomId('back_to_step1')
            .setLabel('⬅️ Сменить инструктора')
            .setStyle(ButtonStyle.Secondary)
    );

    return [row];
}

function createExamButtons(items: ExamItem[]) {
    const row = new ActionRowBuilder<ButtonBuilder>();
    items.forEach((exam: ExamItem) => {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`exam_pick_${exam.id}`)
                .setLabel(`${exam.label} (${exam.cost} EXP)`)
                .setStyle(ButtonStyle.Primary)
        );
    });

    // Кнопка возврата к категориям
    row.addComponents(
        new ButtonBuilder()
            .setCustomId('back_to_step2')
            .setLabel('⬅️ Назад к категориям')
            .setStyle(ButtonStyle.Secondary)
    );

    return [row];
}

function findExamById(id: string): ExamItem | null {
    const categories = Object.values(EXAM_DATA) as ExamCategory[];
    for (const cat of categories) {
        const found = cat.items.find((item: ExamItem) => item.id === id);
        if (found) return found;
    }
    return null;
}