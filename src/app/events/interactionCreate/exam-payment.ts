import { EventHandler } from 'commandkit';
import { 
    ActionRowBuilder, 
    EmbedBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder, 
    TextChannel,
    ButtonInteraction,
    StringSelectMenuInteraction
} from 'discord.js';
import { EXAM_DATA, getRequiredInstructorRoleId, ExamItem } from '@/config/exams';
import { RANKS_DATA } from '@/config/ranks';
import { processExamTransaction, getPlayerExpData } from '@/database/queries';
import { updateBankDisplay } from '@/services/bank.service';

const INSTRUCTORS_CHAT_ID = process.env.INSTRUCTORS_CHAT_ID as string;
const LOGS_CHANNEL_ID = process.env.LOGS_CHANNEL_ID as string;

// Вспомогательная функция для генерации карточки профиля и прогресс-бара
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
        .setFooter({ text: `⚡ Безопасный терминал • ${stepInfo}` })
        .setTimestamp();

    return { embed, student };
}

const handler: EventHandler<"interactionCreate"> = async (interaction, client) => {
    if (!interaction.guild) return;

    // 1. Открытие главного меню оплаты экзамена (Кнопка из канала)
    if (interaction.isButton() && interaction.customId === 'btn_start_exam_pay') {
        const { embed, student } = await generateStudentHeader(interaction.user.id, 'Шаг 1 из 3 • Выберите категорию');

        if (!student) {
            return void await interaction.reply({ 
                content: '❌ Ваш профиль не найден в базе данных! Требуется регистрация.', 
                ephemeral: true 
            });
        }

        embed.setDescription('Добро пожаловать в распределительный узел аттестации.\nВыберите категорию интересующего вас направления с помощью кнопок ниже:');

        // Создаем кнопки для категорий сеткой (до 3 штук в ряд)
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

        return void await interaction.reply({ 
            embeds: [embed], 
            components: rows as any, 
            ephemeral: true 
        });
    }

    // 2. Кнопка возврата в главное меню (Шаг 1)
    if (interaction.isButton() && interaction.customId === 'exam_back_to_main') {
        const { embed } = await generateStudentHeader(interaction.user.id, 'Шаг 1 из 3 • Выберите категорию');
        embed.setDescription('Вы вернулись в главное меню. Выберите категорию экзамена:');

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

        return void await interaction.update({ 
            embeds: [embed], 
            components: rows as any 
        });
    }

    // 3. Выбор категории (Нажатие кнопки категории)
    if (interaction.isButton() && interaction.customId.startsWith('exam_cat_')) {
        const categoryId = interaction.customId.replace('exam_cat_', '');
        const category = EXAM_DATA[categoryId];
        
        if (!category) {
            return void await interaction.reply({ content: '❌ Категория не найдена.', ephemeral: true });
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
        
        // Кнопка назад
        const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId('exam_back_to_main')
                .setLabel('⬅️ Назад к категориям')
                .setStyle(ButtonStyle.Secondary)
        );

        return void await interaction.update({ 
            embeds: [embed], 
            components: [selectRow, backRow] 
        });
    }

    // 4. Выбор конкретного курса / допуска (Выпадающее меню)
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('select_exam_item:')) {
        const parts = interaction.customId.split(':');
        const categoryId = parts[1];
        const itemId = interaction.values[0];

        if (!categoryId || !itemId) return;

        const category = EXAM_DATA[categoryId];
        const item = category?.items.find((i: ExamItem) => i.id === itemId);
        if (!item || !category) {
            return void await interaction.update({ content: '❌ Экзамен не найден.', components: [] });
        }

        const requiredRoleId = getRequiredInstructorRoleId(categoryId, itemId);
        const guild = interaction.guild;

        await guild.members.fetch();

        let instructors = guild.members.cache.filter(m => !m.user.bot);
        if (requiredRoleId) {
            instructors = instructors.filter(m => m.roles.cache.has(requiredRoleId));
        }

        if (instructors.size === 0) {
            const errEmbed = new EmbedBuilder()
                .setTitle('❌ Инструкторы отсутствуют')
                .setColor('#e74c3c')
                .setDescription('В данный момент на сервере нет онлайн-инструкторов с нужной ролью для приема этого экзамена.')
                .setTimestamp();

            const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`exam_cat_${categoryId}`)
                    .setLabel('⬅️ Назад к курсам')
                    .setStyle(ButtonStyle.Secondary)
            );

            return void await interaction.update({ 
                embeds: [errEmbed], 
                components: [backRow] 
            });
        }

        const { embed } = await generateStudentHeader(interaction.user.id, `Шаг 3 из 3 • ${item.label}`);
        embed.setDescription(`🎯 Выбран экзамен: **${item.label}**\n💎 Стоимость: **${item.cost} EXP**\n\nФинальный шаг: выберите инструктора, который принял у вас экзамен:`);

        const instructorMenu = new StringSelectMenuBuilder()
            .setCustomId(`select_instructor:${categoryId}:${itemId}`)
            .setPlaceholder('👤 Выберите принимающего инструктора...')
            .addOptions(
                instructors.map(inst => ({
                    label: inst.displayName,
                    value: inst.id,
                    description: `@${inst.user.username}`
                })).slice(0, 25)
            );

        const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(instructorMenu);
        const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`exam_cat_${categoryId}`)
                .setLabel('⬅️ Назад к курсам')
                .setStyle(ButtonStyle.Secondary)
        );

        return void await interaction.update({ 
            embeds: [embed], 
            components: [selectRow, backRow] 
        });
    }

    // 5. Выбор инструктора и проведение транзакции в базе данных
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('select_instructor:')) {
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

        // Проводим транзакцию через Sequelize
        const res = await processExamTransaction(
            studentDiscId,
            instructorId,
            item.cost,
            instructorReward,
            taxAmount
        );

        if (!res.success) {
            const errorMessages: Record<string, string> = {
                'STUDENT_NOT_FOUND': '❌ Ваш профиль не найден в базе данных!',
                'INSTRUCTOR_NOT_FOUND': '❌ Профиль выбранного инструктора не найден в базе данных!',
                'DB_ERROR': '❌ Произошла ошибка при проведении транзакции в БД.'
            };
            const errEmbed = new EmbedBuilder()
                .setTitle('❌ Сбой транзакции')
                .setColor('#e74c3c')
                .setDescription(errorMessages[res.error ?? 'DB_ERROR'] ?? '❌ Ошибка проведения операции.')
                .setTimestamp();

            return void await interaction.update({ 
                embeds: [errEmbed], 
                components: [] 
            });
        }

        // Обновляем дисплей казны банка
        updateBankDisplay(client as any).catch(console.error);

        // Финальный шикарный Embed для бойца
        const studentNewRankName = res.studentResult ? (RANKS_DATA[res.studentResult.newLvl]?.name ?? 'Неизвестно') : 'Неизвестно';
        const successEmbed = new EmbedBuilder()
            .setTitle('🌟 АТТЕСТАЦИЯ УСПЕШНО ПРОЙДЕНА')
            .setColor('#2ecc71')
            .setDescription(`Поздравляем! Данные об успешной сдаче экзамена зафиксированы в военном билете.`)
            .addFields(
                { name: '📚 Направление', value: item.label, inline: false },
                { name: '💸 Списано с вас', value: `**-${item.cost} EXP**`, inline: true },
                { name: '🎖 Новое звание', value: `**${studentNewRankName}** (${res.studentResult?.newExp} EXP)`, inline: true },
                { name: '👤 Инструктор', value: `<@${instructorId}> (+${instructorReward} EXP)`, inline: false },
                { name: '🏛 Налог в казну банка', value: `+${taxAmount} EXP (${taxPercent}%)`, inline: false }
            )
            .setFooter({ text: 'War Spectra • Автоматизированная система учета' })
            .setTimestamp();

        await interaction.update({ 
            embeds: [successEmbed], 
            components: [] 
        });

        // Уведомление в чат инструкторов
        if (INSTRUCTORS_CHAT_ID && res.instructorResult) {
            const fetchedChannel = await client.channels.fetch(INSTRUCTORS_CHAT_ID).catch(() => null);
            if (fetchedChannel && fetchedChannel.isTextBased() && 'send' in fetchedChannel) {
                const instChannel = fetchedChannel as unknown as TextChannel;
                let textBonus = '';
                if (res.instructorResult.rankChanged) {
                    const oldRankName = RANKS_DATA[res.instructorResult.oldLvl]?.name ?? 'Неизвестно';
                    const newRankName = RANKS_DATA[res.instructorResult.newLvl]?.name ?? 'Неизвестно';
                    textBonus = `\n🎉 **Повышение звания инструктора:** ${oldRankName} ➔ **${newRankName}**!`;
                }

                await instChannel.send({
                    content: `<@${instructorId}>`,
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('🎓 Отчет об экзамене принят')
                            .setColor('#2ecc71')
                            .addFields(
                                { name: 'Курсант', value: `<@${studentDiscId}>`, inline: true },
                                { name: 'Инструктор', value: `<@${instructorId}>`, inline: true },
                                { name: 'Курс', value: item.label, inline: true },
                                { name: 'Награда', value: `+${instructorReward} EXP`, inline: true },
                                { name: 'Налог в Банк', value: `+${taxAmount} EXP`, inline: true }
                            )
                            .setDescription(textBonus || null)
                            .setTimestamp()
                    ]
                });
            }
        }

        // Логирование в канал логов
        if (LOGS_CHANNEL_ID && res.studentResult && res.instructorResult) {
            const fetchedChannel = await client.channels.fetch(LOGS_CHANNEL_ID).catch(() => null);
            if (fetchedChannel && fetchedChannel.isTextBased() && 'send' in fetchedChannel) {
                const logChannel = fetchedChannel as unknown as TextChannel;
                const studentOldRank = RANKS_DATA[res.studentResult.oldLvl]?.name ?? 'Неизвестно';
                const studentNewRank = RANKS_DATA[res.studentResult.newLvl]?.name ?? 'Неизвестно';
                const instOldRank = RANKS_DATA[res.instructorResult.oldLvl]?.name ?? 'Неизвестно';
                const instNewRank = RANKS_DATA[res.instructorResult.newLvl]?.name ?? 'Неизвестно';

                await logChannel.send({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('📜 Аудит транзакций: Экзамены')
                            .setColor('#3498db')
                            .setDescription(
                                `**Курсант:** <@${studentDiscId}>\n` +
                                `• Статус: ${studentOldRank} (${res.studentResult.oldExp}) ➔ ${studentNewRank} (${res.studentResult.newExp} EXP)\n\n` +
                                `**Инструктор:** <@${instructorId}>\n` +
                                `• Статус: ${instOldRank} (${res.instructorResult.oldExp}) ➔ ${instNewRank} (${res.instructorResult.newExp} EXP)\n\n` +
                                `**Экзамен:** ${item.label} (Стоимость: ${item.cost} EXP, Банк: ${taxAmount} EXP)`
                            )
                            .setTimestamp()
                    ]
                });
            }
        }
    }
};

export default handler;