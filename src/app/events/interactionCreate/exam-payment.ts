import { EventHandler } from 'commandkit';
import { 
    ActionRowBuilder, 
    EmbedBuilder, 
    StringSelectMenuBuilder, 
    TextChannel 
} from 'discord.js';
import { EXAM_DATA, getRequiredInstructorRoleId, ExamItem } from '@/config/exams';
import { RANKS_DATA } from '@/config/ranks';
import { processExamTransaction, getPlayerExpData } from '@/database/queries';
import { updateBankDisplay } from '@/services/bank.service';

const INSTRUCTORS_CHAT_ID = process.env.INSTRUCTORS_CHAT_ID as string;
const LOGS_CHANNEL_ID = process.env.LOGS_CHANNEL_ID as string;

const handler: EventHandler<"interactionCreate"> = async (interaction, client) => {
    if (!interaction.guild) return;

    // 1. Нажатие кнопки "💳 Оплатить экзамен"
    if (interaction.isButton() && interaction.customId === 'btn_start_exam_pay') {
        const student = await getPlayerExpData(interaction.user.id);
        if (!student) {
            return void await interaction.reply({ 
                content: '❌ Ваш профиль не найден в базе данных! Сначала зарегистрируйтесь или синхронизируйте профиль.', 
                ephemeral: true 
            });
        }

        const rankInfo = RANKS_DATA[student.pLvl] ?? { name: 'Неизвестно', exp: 100 };
        const nextRankInfo = RANKS_DATA[student.pLvl + 1];
        
        // Красивый прогресс-бар опыта
        const progressPercent = nextRankInfo && nextRankInfo.exp > 0 
            ? Math.min(Math.floor((student.pExp / nextRankInfo.exp) * 100), 100) 
            : 100;
        const filledBlocks = Math.floor(progressPercent / 10);
        const progressBar = '█'.repeat(filledBlocks) + '░'.repeat(10 - filledBlocks);

        const embed = new EmbedBuilder()
            .setTitle('💳 Терминал оплаты экзаменов & курсов')
            .setColor('#3498db')
            .setDescription('Добро пожаловать в систему аттестации **War Spectra**.\nВыберите нужную категорию экзамена в меню ниже.')
            .addFields(
                { name: '🪖 Ваш текущий статус', value: `**Звание:** ${rankInfo.name}\n**Опыт:** \`${student.pExp} EXP\``, inline: false },
                { name: `📈 Прогресс до ранга: ${nextRankInfo?.name || 'Максимум'}`, value: `\`[${progressBar}]\` **${progressPercent}%**`, inline: false }
            )
            .setFooter({ text: 'Шаг 1 из 3 • Выберите категорию экзамена' })
            .setTimestamp();

        const categoryMenu = new StringSelectMenuBuilder()
            .setCustomId('select_exam_category')
            .setPlaceholder('📂 Выберите категорию экзамена...')
            .addOptions(
                Object.values(EXAM_DATA).map(cat => ({
                    label: cat.label,
                    value: cat.id,
                    description: `Курсов в категории: ${cat.items.length}`
                }))
            );

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(categoryMenu);
        return void await interaction.reply({ 
            embeds: [embed], 
            components: [row], 
            ephemeral: true 
        });
    }

    // 2. Выбор категории экзамена
    if (interaction.isStringSelectMenu() && interaction.customId === 'select_exam_category') {
        const categoryId = interaction.values[0];
        if (!categoryId) return;

        const category = EXAM_DATA[categoryId];
        if (!category) {
            return void await interaction.update({ content: '❌ Категория не найдена.', components: [] });
        }

        const student = await getPlayerExpData(interaction.user.id);
        const rankInfo = student ? (RANKS_DATA[student.pLvl]?.name ?? 'Неизвестно') : 'Неизвестно';

        const embed = new EmbedBuilder()
            .setTitle(`💳 Выбор курса: ${category.label}`)
            .setColor('#f39c12')
            .setDescription(`Категория успешно выбрана. Теперь выберите конкретный курс или допуск из списка ниже.`)
            .addFields(
                { name: '👤 Боец', value: `<@${interaction.user.id}> (${rankInfo})`, inline: true },
                { name: '📂 Категория', value: category.label, inline: true }
            )
            .setFooter({ text: 'Шаг 2 из 3 • Выберите сдаваемый курс/допуск' })
            .setTimestamp();

        const itemMenu = new StringSelectMenuBuilder()
            .setCustomId(`select_exam_item:${categoryId}`)
            .setPlaceholder('🎯 Выберите сдаваемый курс / допуск...')
            .addOptions(
                category.items.map((item: ExamItem) => ({
                    label: item.label,
                    value: item.id,
                    description: `Стоимость: ${item.cost} EXP`
                }))
            );

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(itemMenu);
        return void await interaction.update({ 
            embeds: [embed], 
            components: [row] 
        });
    }

    // 3. Выбор конкретного курса / допуска
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
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Инструкторы не найдены')
                .setColor('#e74c3c')
                .setDescription('На сервере в данный момент нет инструкторов с подходящей ролью для принятия этого экзамена.')
                .setTimestamp();

            return void await interaction.update({ 
                embeds: [errorEmbed], 
                components: [] 
            });
        }

        const student = await getPlayerExpData(interaction.user.id);
        const hasEnoughExp = student ? student.pExp >= item.cost || student.pLvl > 0 : true; // Базовая проверка

        const embed = new EmbedBuilder()
            .setTitle(`💳 Оплата экзамена: ${item.label}`)
            .setColor('#9b59b6')
            .setDescription(`Остался финальный шаг! Выберите инструктора, который принял у вас экзамен.`)
            .addFields(
                { name: '🎯 Экзамен', value: item.label, inline: true },
                { name: '💎 Стоимость', value: `**${item.cost} EXP**`, inline: true },
                { name: '⚠️ Баланс', value: student ? `${student.pExp} EXP (Звание: ${RANKS_DATA[student.pLvl]?.name})` : 'Нет данных', inline: false }
            )
            .setFooter({ text: 'Шаг 3 из 3 • Выберите принявшего инструктора' })
            .setTimestamp();

        const instructorMenu = new StringSelectMenuBuilder()
            .setCustomId(`select_instructor:${categoryId}:${itemId}`)
            .setPlaceholder('👤 Выберите инструктора...')
            .addOptions(
                instructors.map(inst => ({
                    label: inst.displayName,
                    value: inst.id,
                    description: `@${inst.user.username}`
                })).slice(0, 25)
            );

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(instructorMenu);
        return void await interaction.update({ 
            embeds: [embed], 
            components: [row] 
        });
    }

    // 4. Выбор инструктора и транзакция
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

        // Вызов транзакции в базе данных
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
                .setTitle('❌ Ошибка транзакции')
                .setColor('#e74c3c')
                .setDescription(errorMessages[res.error ?? 'DB_ERROR'] ?? '❌ Произошла ошибка.')
                .setTimestamp();

            return void await interaction.update({ 
                embeds: [errEmbed], 
                components: [] 
            });
        }

        // Обновляем счетчик банка в Discord
        updateBankDisplay(client as any).catch(console.error);

        // Красивый финальный Embed для игрока
        const studentNewRankName = res.studentResult ? (RANKS_DATA[res.studentResult.newLvl]?.name ?? 'Неизвестно') : 'Неизвестно';
        const successEmbed = new EmbedBuilder()
            .setTitle('✅ Экзамен успешно оплачен!')
            .setColor('#2ecc71')
            .setDescription(`Вы успешно прошли аттестацию по курсу **${item.label}**.\nСредства списаны с вашего баланса, инструктор получил вознаграждение, а налог отправлен в казну банка.`)
            .addFields(
                { name: '📚 Сданный курс', value: item.label, inline: false },
                { name: '💸 Списано с вас', value: `**-${item.cost} EXP**`, inline: true },
                { name: '🎖 Ваше новое звание', value: `${studentNewRankName} (${res.studentResult?.newExp} EXP)`, inline: true },
                { name: '👤 Инструктор', value: `<@${instructorId}>`, inline: true },
                { name: '💰 Налог в Банк', value: `+${taxAmount} EXP (${taxPercent}%)`, inline: true }
            )
            .setFooter({ text: 'War Spectra • Система аттестации' })
            .setTimestamp();

        await interaction.update({ 
            embeds: [successEmbed], 
            components: [] 
        });

        // Отправка уведомления в чат инструкторов
        if (INSTRUCTORS_CHAT_ID && res.instructorResult) {
            const fetchedChannel = await client.channels.fetch(INSTRUCTORS_CHAT_ID).catch(() => null);
            if (fetchedChannel && fetchedChannel.isTextBased() && 'send' in fetchedChannel) {
                const instChannel = fetchedChannel as unknown as TextChannel;
                let textBonus = '';
                if (res.instructorResult.rankChanged) {
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
            }
        }

        // Логирование операции в канал логов
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
                            .setTitle('📜 Логирование Оплаты Экзаменов')
                            .setColor('#3498db')
                            .setDescription(
                                `**Ученик:** <@${studentDiscId}>\n` +
                                `• Исходное звание/опыт: ${studentOldRank} (${res.studentResult.oldExp} EXP)\n` +
                                `• Новое звание/опыт: ${studentNewRank} (${res.studentResult.newExp} EXP)\n\n` +
                                `**Инструктор:** <@${instructorId}>\n` +
                                `• Исходное звание/опыт: ${instOldRank} (${res.instructorResult.oldExp} EXP)\n` +
                                `• Новое звание/опыт: ${instNewRank} (${res.instructorResult.newExp} EXP)\n\n` +
                                `**Экзамен:** ${item.label} (Списано: ${item.cost} EXP, В Банк: ${taxAmount} EXP)`
                            )
                            .setTimestamp()
                    ]
                });
            }
        }
    }
};

export default handler;