import { EventHandler } from 'commandkit';
import { 
    ActionRowBuilder, 
    EmbedBuilder, 
    StringSelectMenuBuilder, 
    TextChannel 
} from 'discord.js';
import { EXAM_DATA, getRequiredInstructorRoleId, ExamItem } from '@/config/exams';
import { RANKS_DATA } from '@/config/ranks';
import { processExamTransaction } from '@/database/queries';
import { updateBankDisplay } from '@/services/bank.service';

const INSTRUCTORS_CHAT_ID = process.env.INSTRUCTORS_CHAT_ID as string;
const LOGS_CHANNEL_ID = process.env.LOGS_CHANNEL_ID as string;

const handler: EventHandler<"interactionCreate"> = async (interaction, client) => {
    if (!interaction.guild) return;

    // 1. Нажатие кнопки "💳 Оплатить экзамен"
    if (interaction.isButton() && interaction.customId === 'btn_start_exam_pay') {
        const categoryMenu = new StringSelectMenuBuilder()
            .setCustomId('select_exam_category')
            .setPlaceholder('Выберите категорию экзамена...')
            .addOptions(
                Object.values(EXAM_DATA).map(cat => ({
                    label: cat.label,
                    value: cat.id
                }))
            );

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(categoryMenu);
        return void await interaction.reply({ 
            content: 'Шаг 1/3: Выберите категорию:', 
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
            return void await interaction.reply({ content: 'Категория не найдена.', ephemeral: true });
        }

        const itemMenu = new StringSelectMenuBuilder()
            .setCustomId(`select_exam_item:${categoryId}`)
            .setPlaceholder('Выберите сдаваемый курс/допуск...')
            .addOptions(
                category.items.map((item: ExamItem) => ({
                    label: `${item.label} — ${item.cost} EXP`,
                    value: item.id
                }))
            );

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(itemMenu);
        return void await interaction.update({ 
            content: `Шаг 2/3: Категория **${category.label}**. Выберите экзамен:`, 
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
        if (!item) {
            return void await interaction.reply({ content: 'Экзамен не найден.', ephemeral: true });
        }

        const requiredRoleId = getRequiredInstructorRoleId(categoryId, itemId);
        const guild = interaction.guild;

        await guild.members.fetch();

        let instructors = guild.members.cache.filter(m => !m.user.bot);
        if (requiredRoleId) {
            instructors = instructors.filter(m => m.roles.cache.has(requiredRoleId));
        }

        if (instructors.size === 0) {
            return void await interaction.update({ 
                content: '❌ К сожалению, на сервере сейчас нет инструкторов с подходящей ролью для принятия этого экзамена.', 
                components: [] 
            });
        }

        const instructorMenu = new StringSelectMenuBuilder()
            .setCustomId(`select_instructor:${categoryId}:${itemId}`)
            .setPlaceholder('Выберите инструктора, принявшего экзамен...')
            .addOptions(
                instructors.map(inst => ({
                    label: inst.displayName,
                    value: inst.id,
                    description: `@${inst.user.username}`
                })).slice(0, 25)
            );

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(instructorMenu);
        return void await interaction.update({ 
            content: `Шаг 3/3: Экзамен **${item.label}** (${item.cost} EXP). Выберите инструктора:`, 
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
            return void await interaction.update({ 
                content: errorMessages[res.error ?? 'DB_ERROR'] ?? '❌ Произошла ошибка.', 
                components: [] 
            });
        }

        // Обновляем счетчик банка в Discord (приведение client к any убирает конфликт Client<true> vs Client)
        updateBankDisplay(client as any).catch(console.error);

        await interaction.update({ 
            content: `✅ Оплата за экзамен **${item.label}** прошла успешно!\nСписано: **${item.cost} EXP** (Инструктор: **+${instructorReward} EXP**, Банк: **+${taxAmount} EXP**).`, 
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