import { EventHandler } from 'commandkit';
import { 
    ActionRowBuilder, 
    EmbedBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder, 
    TextChannel,
    MessageFlags
} from 'discord.js';
import { EXAM_DATA, getRequiredInstructorRoleId, ExamItem } from '@/config/exams';
import { RANKS_DATA } from '@/config/ranks';
import { processExamTransaction, getPlayerExpData } from '@/database/queries';
import { updateBankDisplay } from '@/services/bank.service';

const INSTRUCTORS_CHAT_ID = process.env.INSTRUCTORS_CHAT_ID as string;
const LOGS_CHANNEL_ID = process.env.LOGS_CHANNEL_ID as string;

// Вспомогательная функция генерации карточки бойца
async function generateStudentHeader(userId: string, stepInfo: string) {
    const student = await getPlayerExpData(userId);
    const rankInfo = student ? (RANKS_DATA[student.pLvl] ?? { name: 'Рекрут', exp: 100 }) : { name: 'Рекрут', exp: 100 };
    const nextRankInfo = RANKS_DATA[(student?.pLvl ?? 0) + 1];
    const currentExp = student?.pExp ?? 0;

    const progressPercent = nextRankInfo && nextRankInfo.exp > 0 
        ? Math.min(Math.floor((currentExp / nextRankInfo.exp) * 100), 100) 
        : 100;
    const filledBlocks = Math.floor(progressPercent / 10);
    const progressBar = '▰'.repeat(filledBlocks) + '▱'.repeat(10 - filledBlocks);

    const embed = new EmbedBuilder()
        .setTitle('🛡️ WAR SPECTRA // ЦЕНТР АТТЕСТАЦИИ И КУРСОВ')
        .setColor('#2b2d31')
        .addFields(
            { 
                name: '🪖 Профиль бойца', 
                value: `**Звание:** ${rankInfo.name}\n**Баланс опыта:** \`${currentExp} EXP\``, 
                inline: true 
            },
            { 
                name: `📈 До ранга: ${nextRankInfo?.name || 'MAX'}`, 
                value: `\`${progressBar}\` **${progressPercent}%**`, 
                inline: true 
            }
        )
        .setFooter({ text: `⚡ Защищенный терминал • ${stepInfo}` })
        .setTimestamp();

    return { embed, student };
}

// Рендер кнопок категорий (сетка)
function getCategoryButtons() {
    const categories = Object.values(EXAM_DATA);
    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    let currentRow = new ActionRowBuilder<ButtonBuilder>();

    categories.forEach((cat, index) => {
        if (index > 0 && index % 3 === 0) {
            rows.push(currentRow);
            currentRow = new ActionRowBuilder<ButtonBuilder>();
        }
        currentRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`exam_cat_${cat.id}`)
                .setLabel(cat.label)
                .setStyle(ButtonStyle.Primary)
        );
    });

    if (currentRow.components.length > 0) {
        rows.push(currentRow);
    }
    return rows;
}

const handler: EventHandler<"interactionCreate"> = async (interaction, client) => {
    if (!interaction.guild) return;

    // 1. Открытие главного меню оплаты из канала (Reply)
    if (interaction.isButton() && interaction.customId === 'btn_start_exam_pay') {
        const { embed, student } = await generateStudentHeader(interaction.user.id, 'Шаг 1 из 3 • Выберите категорию');

        if (!student) {
            return void await interaction.reply({ 
                content: '❌ Ваш профиль не найден в базе данных! Требуется регистрация.', 
                flags: MessageFlags.Ephemeral 
            });
        }

        embed.setDescription('Выберите категорию интересующего вас направления с помощью интерактивных кнопок ниже:');

        return void await interaction.reply({ 
            embeds: [embed], 
            components: getCategoryButtons() as any, 
            flags: MessageFlags.Ephemeral 
        });
    }

    // 2. Кнопка возврата в главное меню (Update)
    if (interaction.isButton() && interaction.customId === 'exam_back_to_main') {
        await interaction.deferUpdate().catch(() => {});
        const { embed } = await generateStudentHeader(interaction.user.id, 'Шаг 1 из 3 • Выберите категорию');
        embed.setDescription('Вы вернулись в главное меню. Выберите категорию экзамена:');

        return void await interaction.editReply({ 
            embeds: [embed], 
            components: getCategoryButtons() as any 
        });
    }

    // 3. Выбор категории (Кнопка категории)
    if (interaction.isButton() && interaction.customId.startsWith('exam_cat_')) {
        await interaction.deferUpdate().catch(() => {});
        const categoryId = interaction.customId.replace('exam_cat_', '');
        const category = EXAM_DATA[categoryId];
        
        if (!category) {
            return void await interaction.editReply({ content: '❌ Категория не найдена.', components: [] });
        }

        const { embed } = await generateStudentHeader(interaction.user.id, `Шаг 2 из 3 • Категория: ${category.label}`);
        embed.setDescription(`📂 Категория: **${category.label}**\nВыберите конкретный курс или допуск для сдачи в выпадающем меню ниже:`);

        const itemMenu = new StringSelectMenuBuilder()
            .setCustomId(`select_exam_item:${categoryId}`)
            .setPlaceholder('🎯 Выберите курс / допуск...')
            .addOptions(
                category.items.map((item: ExamItem) => ({
                    label: item.label,
                    value: item.id,
                    description: `Стоимость аттестации: ${item.cost} EXP`
                }))
            );

        const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(itemMenu);
        const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId('exam_back_to_main')
                .setLabel('⬅️ Назад к категориям')
                .setStyle(ButtonStyle.Secondary)
        );

        return void await interaction.editReply({ 
            embeds: [embed], 
            components: [selectRow, backRow] 
        });
    }

    // 4. Выбор конкретного курса / допуска (Выпадающее меню) -> Выбор инструктора
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('select_exam_item:')) {
        await interaction.deferUpdate().catch(() => {});
        const parts = interaction.customId.split(':');
        const categoryId = parts[1];
        const itemId = interaction.values[0];

        if (!categoryId || !itemId) return;

        const category = EXAM_DATA[categoryId];
        const item = category?.items.find((i: ExamItem) => i.id === itemId);
        if (!item || !category) {
            return void await interaction.editReply({ content: '❌ Экзамен не найден.', components: [] });
        }

        const requiredRoleId = getRequiredInstructorRoleId(categoryId, itemId);
        const guild = interaction.guild;

        // ГАРАНТИРОВАННОЕ ПОЛУЧЕНИЕ ВСЕХ ИНСТРУКТОРОВ С СЕРВЕРА
        let instructors;
        if (requiredRoleId) {
            // Подтягиваем роль и всех её участников с сервера
            const role = await guild.roles.fetch(requiredRoleId).catch(() => null);
            if (role) {
                // Если у роли есть метод .members, подгружаем их на всякий случай
                await guild.members.fetch().catch(() => {});
                instructors = role.members.filter(m => !m.user.bot);
            } else {
                instructors = guild.members.cache.filter(m => !m.user.bot);
            }
        } else {
            await guild.members.fetch({ limit: 100 }).catch(() => {});
            instructors = guild.members.cache.filter(m => !m.user.bot);
        }

        if (instructors.size === 0) {
            const errEmbed = new EmbedBuilder()
                .setTitle('❌ Инструкторы отсутствуют')
                .setColor('#e74c3c')
                .setDescription('В данный момент на сервере нет доступных инструкторов с нужной ролью (или боту не хватает интента Server Members Intent).')
                .setTimestamp();

            const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`exam_cat_${categoryId}`)
                    .setLabel('⬅️ Назад к курсам')
                    .setStyle(ButtonStyle.Secondary)
            );

            return void await interaction.editReply({ 
                embeds: [errEmbed], 
                components: [backRow] 
            });
        }

        const { embed } = await generateStudentHeader(interaction.user.id, `Шаг 3 из 3 • ${item.label}`);
        embed.setDescription(`🎯 Выбран экзамен: **${item.label}**\n💎 Стоимость: **${item.cost} EXP**\n\nФинальный шаг: выберите инструктора из списка:`);

        const instructorMenu = new StringSelectMenuBuilder()
            .setCustomId(`select_instructor:${categoryId}:${itemId}`)
            .setPlaceholder('👤 Выберите принимающего инструктора...')
            .addOptions(
                instructors.map(inst => ({
                    label: inst.displayName.slice(0, 100),
                    value: inst.id,
                    description: `@${inst.user.username}`
                })).slice(0, 25) // Дискорд позволяет максимум 25 элементов в селект-меню
            );

        const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(instructorMenu);
        const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`exam_cat_${categoryId}`)
                .setLabel('⬅️ Назад к курсам')
                .setStyle(ButtonStyle.Secondary)
        );

        return void await interaction.editReply({ 
            embeds: [embed], 
            components: [selectRow, backRow] 
        });
    }

    // 5. Финальный выбор инструктора и проведение транзакции
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('select_instructor:')) {
        await interaction.deferUpdate().catch(() => {});
        const parts = interaction.customId.split(':');
        const categoryId = parts[1];
        const itemId = parts[2];
        const instructorId = interaction.values[0];
        const studentDiscId = interaction.user.id;

        if (!categoryId || !itemId || !instructorId) return;

        const category = EXAM_DATA[categoryId];
        const item = category?.items.find((i: ExamItem) => i.id === itemId);
        if (!item || !category) return;

        const taxPercent = item.taxPercent ?? category.defaultTaxPercent;
        const taxAmount = Math.floor(item.cost * (taxPercent / 100));
        const instructorReward = item.cost - taxAmount;

        const res = await processExamTransaction(
            studentDiscId,
            instructorId,
            item.cost,
            instructorReward,
            taxAmount
        );

        if (!res.success) {
            const errEmbed = new EmbedBuilder()
                .setTitle('❌ Сбой транзакции')
                .setColor('#e74c3c')
                .setDescription('❌ Ошибка проведения операции в базе данных.')
                .setTimestamp();

            return void await interaction.editReply({ embeds: [errEmbed], components: [] });
        }

        updateBankDisplay(client as any).catch(console.error);

        const studentNewRankName = res.studentResult ? (RANKS_DATA[res.studentResult.newLvl]?.name ?? 'Неизвестно') : 'Неизвестно';
        const successEmbed = new EmbedBuilder()
            .setTitle('🌟 АТТЕСТАЦИЯ УСПЕШНО ПРОЙДЕНА')
            .setColor('#2ecc71')
            .setDescription('Поздравляем! Данные об успешной сдаче экзамена зафиксированы.')
            .addFields(
                { name: '📚 Направление', value: item.label, inline: false },
                { name: '💸 Списано с вас', value: `**-${item.cost} EXP**`, inline: true },
                { name: '🎖 Новое звание', value: `**${studentNewRankName}**`, inline: true },
                { name: '👤 Инструктор', value: `<@${instructorId}> (+${instructorReward} EXP)`, inline: false },
                { name: '🏛 Налог в казну банка', value: `+${taxAmount} EXP (${taxPercent}%)`, inline: false }
            )
            .setFooter({ text: 'War Spectra • Система учета' })
            .setTimestamp();

        await interaction.editReply({ embeds: [successEmbed], components: [] });

        // Отправка отчета в чат инструкторов
        if (INSTRUCTORS_CHAT_ID) {
            try {
                const fetchedChannel = await client.channels.fetch(INSTRUCTORS_CHAT_ID).catch(() => null);
                if (fetchedChannel && fetchedChannel.isTextBased() && 'send' in fetchedChannel) {
                    const instChannel = fetchedChannel as unknown as TextChannel;
                    
                    let textBonus = '';
                    if (res.instructorResult?.rankChanged) {
                        const oldRankName = RANKS_DATA[res.instructorResult.oldLvl]?.name ?? 'Неизвестно';
                        const newRankName = RANKS_DATA[res.instructorResult.newLvl]?.name ?? 'Неизвестно';
                        textBonus = `\n🎉 **Инструктор повышен в звании:** ${oldRankName} ➔ **${newRankName}**!`;
                    }

                    await instChannel.send({
                        content: `<@${instructorId}>`,
                        embeds: [
                            new EmbedBuilder()
                                .setTitle('🎓 Оплата за экзамен получена!')
                                .setColor('#2ecc71')
                                .addFields(
                                    { name: 'Ученик', value: `<@${studentDiscId}>`, inline: true },
                                    { name: 'Инструктор', value: `<@${instructorId}>`, inline: true },
                                    { name: 'Экзамен', value: item.label, inline: true },
                                    { name: 'Начислено инструктору', value: `+${instructorReward} EXP`, inline: true },
                                    { name: 'Налог в Банк', value: `+${taxAmount} EXP (${taxPercent}%)`, inline: true }
                                )
                                .setDescription(textBonus || null)
                                .setTimestamp()
                        ]
                    });
                } else {
                    console.warn(`[WARN] Канал инструкторов (ID: ${INSTRUCTORS_CHAT_ID}) не найден или туда нельзя отправить сообщение!`);
                }
            } catch (err) {
                console.error('[ERROR] Ошибка отправки отчета в чат инструкторов:', err);
            }
        }
    }
};

export default handler;