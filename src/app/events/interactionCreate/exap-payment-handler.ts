import { 
    Interaction, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    UserSelectMenuBuilder 
} from 'discord.js';
import { EXAM_DATA, ExamCategory, ExamItem } from '../../../config/exams';
import { processExamPayment } from '../../../database/queries';

export default async function (interaction: Interaction) {
    if (!interaction.isButton() || interaction.customId !== 'start_exam_pay') return;

    const instructorSelect = new UserSelectMenuBuilder()
        .setCustomId('select_instructor')
        .setPlaceholder('Выберите инструктора, принявшего экзамен');

    const row1 = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(instructorSelect);

    const response = await interaction.reply({
        content: '👤 **Шаг 1 из 3:** Выберите инструктора из списка:',
        components: [row1],
        ephemeral: true,
        fetchReply: true,
    });

    const collector = response.createMessageComponentCollector({
        time: 120_000,
    });

    let selectedInstructorId: string | null = null;
    let selectedExam: ExamItem | null = null;

    collector.on('collect', async (i) => {
        // --- Выбор инструктора ---
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
                await i.reply({ content: '❌ Нельзя переводить опыт бота!', ephemeral: true });
                return;
            }

            selectedInstructorId = chosenId;

            const categoryRows = createCategoryButtons();
            await i.update({
                content: `👤 Инструктор: <@${selectedInstructorId}>\n📂 **Шаг 2 из 3:** Выберите категорию экзамена:`,
                components: categoryRows,
            });
        }

        // --- Обработка нажатий на кнопки ---
        if (i.isButton()) {
            if (i.customId.startsWith('select_category_')) {
                const categoryId = i.customId.replace('select_category_', '');
                const category = EXAM_DATA[categoryId];
                if (category) {
                    const examRows = createExamButtons(category.items);
                    await i.update({
                        content: `👤 Инструктор: <@${selectedInstructorId}>\n📋 Категория: **${category.label}**\n\nВыберите экзамен:`,
                        components: examRows,
                    });
                }
            }

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
                            { name: 'Курсант', value: `<@${i.user.id}>`, inline: true },
                            { name: 'Инструктор', value: `<@${selectedInstructorId}>`, inline: true },
                            { name: 'Экзамен', value: `${selectedExam.label}`, inline: false },
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

            if (i.customId === 'cancel_pay') {
                collector.stop('cancelled');
                await i.update({ content: '❌ Перевод отменен.', embeds: [], components: [] });
            }

            if (i.customId === 'confirm_pay' && selectedInstructorId && selectedExam) {
                await i.deferUpdate();

                const result = await processExamPayment(
                    i.user.id,
                    selectedInstructorId,
                    selectedExam.cost
                );

                if (result.success) {
                    const successEmbed = new EmbedBuilder()
                        .setTitle('✅ Оплата пройдена успешно!')
                        .setColor('#2ecc71')
                        .setDescription(
                            `Вы перевели **${selectedExam.cost} EXP** за экзамен **${selectedExam.label}**.\n\n` +
                            `• Инструктор <@${selectedInstructorId}> получил: **${Math.floor(selectedExam.cost * 0.8)} EXP**\n` +
                            `• В банк отправлено: **${Math.ceil(selectedExam.cost * 0.2)} EXP**\n` +
                            `• Ваш остаток: **${result.studentExpLeft} EXP**`
                        );

                    await i.editReply({ content: '', embeds: [successEmbed], components: [] });
                    collector.stop('completed');
                } else {
                    let errorMsg = '💥 Произошла непредвиденная ошибка.';
                    if (result.error === 'STUDENT_NOT_FOUND') {
                        errorMsg = '❌ Ваш профиль не найден в базе данных (не привязан Discord)!';
                    } else if (result.error === 'INSTRUCTOR_NOT_FOUND') {
                        errorMsg = '❌ Профиль инструктора не найден в базе данных (не привязан Discord)!';
                    } else if (result.error === 'NOT_ENOUGH_EXP') {
                        errorMsg = '❌ У вас недостаточно опыта для оплаты этого экзамена!';
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

    return [row];
}

function createExamButtons(items: ExamItem[]) {
    const row = new ActionRowBuilder<ButtonBuilder>();
    items.forEach((exam: ExamItem) => {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`exam_pick_${exam.id}`)
                .setLabel(`${exam.label} (${exam.cost} EXP)`)
                .setStyle(ButtonStyle.Secondary)
        );
    });

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