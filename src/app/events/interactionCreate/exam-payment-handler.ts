import { 
    Interaction, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ChannelType,
    GuildMember,
    RepliableInteraction
} from 'discord.js';
import { EXAM_DATA, ExamCategory, ExamItem, getRequiredInstructorRoleId } from '../../../config/exams';
import { processExamPayment, findPlayer } from '../../../database/queries';
import { sendAdminLog } from '../../../utils/logger';
import { updateBankDisplay } from '@/services/bankService';
import { RANKS_DATA } from '../../../config/ranks';

const EXAMINERS_CHANNEL_ID = process.env.EXAMINERS_CHANNEL_ID as string;

// Вспомогательная функция для предварительной проверки понижения ранга
function calculateRankDemotion(currentExp: number, currentRankName: string, cost: number) {
    let expLeft = currentExp - cost;
    let rankName = currentRankName;
    const initialRank = currentRankName;
    let rankChanged = false;

    while (expLeft < 0) {
        const currentRankIndex = RANKS_DATA.findIndex(
            (r) => r.name === rankName || r.fullName === rankName || r.shortName === rankName
        );

        if (currentRankIndex <= 0) {
            return {
                willDemote: false,
                oldRank: initialRank,
                newRank: rankName,
                finalExp: expLeft,
                insufficientExp: true,
            };
        }

        const prevRank = RANKS_DATA[currentRankIndex - 1];
        if (!prevRank) break;

        expLeft = prevRank.exp + expLeft;
        rankName = prevRank.name;
        rankChanged = true;
    }

    return {
        willDemote: rankChanged,
        oldRank: initialRank,
        newRank: rankName,
        finalExp: expLeft,
        insufficientExp: false,
    };
}

export default async function (interaction: Interaction) {
    if (!interaction.isButton() || interaction.customId !== 'start_exam_pay') return;
    if (!interaction.inCachedGuild()) return;

    // Ищем игрока в БД, чтобы получить текущий баланс
    const studentData = await findPlayer({ discordId: interaction.user.id });

    if (!studentData) {
        return void interaction.reply({
            content: '❌ Ваш аккаунт Discord не привязан к игровой базе данных!',
            ephemeral: true
        });
    }

    // Состояния текущей сессии
    let selectedCategoryId: string | null = null;
    let selectedInstructorId: string | null = null;
    let selectedExam: ExamItem | null = null;

    // Отрисовка Шага 1: Выбор Категории
    const renderStep1Categories = () => {
        const row = createCategoryButtons();
        return {
            content: `💳 **Ваш текущий баланс:** **${studentData.pExp}** EXP | Звание: **${studentData.pLvl}**\n\n📂 **Шаг 1 из 3:** Выберите категорию экзамена:`,
            embeds: [],
            components: row,
        };
    };

    // Инициализация интерфейса
    const response = await interaction.reply({
        ...renderStep1Categories(),
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
                selectedCategoryId = null;
                selectedInstructorId = null;
                await i.update(renderStep1Categories());
                return;
            }

            if (target === 'step2') {
                selectedExam = null;
                if (selectedCategoryId) {
                    const step2Components = await buildInstructorStepComponents(i, selectedCategoryId);
                    await i.update(step2Components);
                }
                return;
            }
        }

        // --- ШАГ 1: Клик по кнопке категории ➔ Переход к Шагу 2 (Выбор инструктора) ---
        if (i.isButton() && i.customId.startsWith('select_category_')) {
            selectedCategoryId = i.customId.replace('select_category_', '');
            const step2Components = await buildInstructorStepComponents(i, selectedCategoryId);
            await i.update(step2Components);
            return;
        }

        // --- ШАГ 2: Выбор инструктора из выпадающего списка ➔ Переход к выбору экзамена ---
        if (i.isStringSelectMenu() && i.customId === 'select_instructor') {
            selectedInstructorId = i.values[0] ?? null;

            if (selectedInstructorId === i.user.id) {
                await i.reply({ content: '❌ Вы не можете переводить опыт самому себе!', ephemeral: true });
                return;
            }

            if (selectedCategoryId) {
                const category = EXAM_DATA[selectedCategoryId];
                if (category) {
                    const examRows = createExamButtons(category.items);
                    await i.update({
                        content: `💳 **Ваш баланс:** **${studentData.pExp}** EXP\n📋 Категория: **${category.label}**\n👤 Инструктор: <@${selectedInstructorId}>\n\n📋 **Шаг 3 из 3:** Выберите конкретный экзамен:`,
                        embeds: [],
                        components: examRows,
                    });
                }
            }
            return;
        }

        // --- ШАГ 3: Выбор экзамена ➔ Отображение экрана подтверждения ---
        if (i.isButton() && i.customId.startsWith('exam_pick_')) {
            const examId = i.customId.replace('exam_pick_', '');
            selectedExam = findExamById(examId);

            if (selectedExam && selectedInstructorId) {
                const instructorExp = Math.floor(selectedExam.cost * 0.8);
                const bankExp = Math.ceil(selectedExam.cost * 0.2);

                const demotionPreview = calculateRankDemotion(
                    Number(studentData.pExp) || 0,
                    studentData.pLvl,
                    selectedExam.cost
                );

                const confirmEmbed = new EmbedBuilder()
                    .setTitle('⚙️ Подтверждение перевода')
                    .setColor(demotionPreview.willDemote ? '#e74c3c' : '#f1c40f')
                    .addFields(
                        { name: 'Курсант', value: `<@${i.user.id}> (Баланс: ${studentData.pExp} EXP)`, inline: false },
                        { name: 'Инструктор', value: `<@${selectedInstructorId}>`, inline: true },
                        { name: 'Экзамен', value: `${selectedExam.label}`, inline: true },
                        { name: 'Сумма списания', value: `**${selectedExam.cost}** EXP`, inline: true },
                        { name: 'Получит инструктор (80%)', value: `**${instructorExp}** EXP`, inline: true },
                        { name: 'Комиссия в банк (20%)', value: `**${bankExp}** EXP`, inline: true }
                    );

                if (demotionPreview.willDemote) {
                    confirmEmbed.addFields({
                        name: '⚠️ ВНИМАНИЕ: ПОНИЖЕНИЕ ЗВАНИЯ',
                        value: `Вашего текущего опыта не хватает для покрытия стоимости экзамена.\n` +
                               `В результате оплаты ваше звание будет понижено:\n` +
                               `\`${demotionPreview.oldRank}\` ➔ \`${demotionPreview.newRank}\`\n` +
                               `*Остаток EXP после понижения: **${demotionPreview.finalExp} EXP***`,
                        inline: false
                    });
                }

                const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                        .setCustomId('confirm_pay')
                        .setLabel(demotionPreview.willDemote ? 'Подтвердить (с понижением)' : 'Подтвердить перевод')
                        .setStyle(demotionPreview.willDemote ? ButtonStyle.Danger : ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('back_to_step2')
                        .setLabel('⬅️ Назад к выбору')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('cancel_pay')
                        .setLabel('Отмена')
                        .setStyle(ButtonStyle.Secondary)
                );

                await i.update({
                    content: demotionPreview.willDemote 
                        ? '⚠️ **Проверьте детали перевода:** (Оплата приведет к понижению ранга!)'
                        : '⚠️ **Проверьте детали перевода:**',
                    embeds: [confirmEmbed],
                    components: [confirmRow],
                });
            }
            return;
        }

        // Отмена
        if (i.isButton() && i.customId === 'cancel_pay') {
            collector.stop('cancelled');
            await i.update({ content: '❌ Перевод отменен.', embeds: [], components: [] });
            return;
        }

        // Подтверждение оплаты
        if (i.isButton() && i.customId === 'confirm_pay' && selectedInstructorId && selectedExam) {
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
                    rankNotice = `\n\n🔻 **Внимание! Ваш ранг был понижен:** \`${result.oldRank}\` ➔ \`${result.newRank}\``;
                }

                const successEmbed = new EmbedBuilder()
                    .setTitle('✅ Оплата пройдена успешно!')
                    .setColor(result.rankChanged ? '#e67e22' : '#2ecc71')
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

                // Логирование и отправка в канал экзаменаторов
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
                                ...(result.rankChanged ? [{ name: '🔻 Изменение звания', value: `\`${result.oldRank}\` ➔ \`${result.newRank}\``, inline: false }] : [])
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

                await sendAdminLog({
                    title: '💳 Оплата экзамена',
                    description: `Курсант <@${i.user.id}> перевел опыт инструктору <@${selectedInstructorId}>.`,
                    color: result.rankChanged ? '#e67e22' : '#2ecc71',
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
                    errorMsg = '❌ У вас недостаточно опыта даже при максимально возможном понижении звания!';
                }

                await i.editReply({ content: errorMsg, embeds: [], components: [] });
                collector.stop('error');
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

// Вспомогательные функции отрисовки и сборки компонента

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

async function buildInstructorStepComponents(interaction: RepliableInteraction, categoryId: string) {
    if (!interaction.inCachedGuild()) {
        return { content: '❌ Ошибка гильдии.', components: [] };
    }

    const category = EXAM_DATA[categoryId];
    const categoryLabel = category ? category.label : categoryId;
    const requiredRoleId = getRequiredInstructorRoleId(categoryId);

    let eligibleMembers: GuildMember[] = [];
    if (requiredRoleId) {
        const role = await interaction.guild.roles.fetch(requiredRoleId).catch(() => null);
        if (role) {
            eligibleMembers = Array.from(role.members.values()).filter(m => !m.user.bot);
        }
    }

    if (eligibleMembers.length === 0) {
        const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId('back_to_step1')
                .setLabel('⬅️ Назад к категориям')
                .setStyle(ButtonStyle.Secondary)
        );
        return {
            content: `📂 Категория: **${categoryLabel}**\n❌ **В данной категории пока нет доступных инструкторов на сервере!**`,
            components: [backRow],
        };
    }

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_instructor')
        .setPlaceholder('Выберите квалифицированного инструктора...')
        .addOptions(
            eligibleMembers.slice(0, 25).map(member => 
                new StringSelectMenuOptionBuilder()
                    .setLabel(member.displayName)
                    .setValue(member.id)
                    .setDescription(`Ник: ${member.user.username}`)
            )
        );

    const menuRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
    
    const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('back_to_step1')
            .setLabel('⬅️ Сменить категорию')
            .setStyle(ButtonStyle.Secondary)
    );

    return {
        content: `📂 Категория: **${categoryLabel}**\n👤 **Шаг 2 из 3:** Выберите инструктора с соответствующей ролью:`,
        components: [menuRow, backRow],
    };
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

    row.addComponents(
        new ButtonBuilder()
            .setCustomId('back_to_step2')
            .setLabel('⬅️ Назад к инструкторам')
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