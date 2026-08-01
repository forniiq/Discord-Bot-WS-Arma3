import { EmbedBuilder } from 'discord.js';
import { findAllSyncablePlayers } from '@/database/queries';
import { syncPlayerProfile } from '@/services/playerSyncService';
import { sendLog } from '@/utils/logger';

export async function runBulkSync(guild: any, interaction: any) {
    const startTime = Date.now();

    // 1. Первичный статус (Сбрасываем кнопки и контент)
    const initialEmbed = new EmbedBuilder()
        .setTitle('🔄 Запуск массовой синхронизации ролей...')
        .setDescription('📡 Подгрузка кэша пользователей Discord и базы данных...')
        .setColor('#e67e22');

    await interaction.editReply({ 
        content: null, 
        embeds: [initialEmbed], 
        components: [] 
    });

    // 2. Сбор кэша участников сервера (1 вызов к API)
    await guild.members.fetch();

    // 3. Получение всех привязанных пользователей из БД (1 SQL запрос)
    const players = await findAllSyncablePlayers();
    const totalPlayers = players.length;

    let processed = 0;
    let rolesUpdated = 0;
    let namesUpdated = 0;
    let errors = 0;

    const CHUNK_SIZE = 15;      // Пачки по 15 участников
    const DELAY_MS = 500;       // Пауза 0.5с между пачками

    let lastUpdateUI = Date.now();

    for (let i = 0; i < totalPlayers; i += CHUNK_SIZE) {
        const chunk = players.slice(i, i + CHUNK_SIZE);

        await Promise.all(chunk.map(async (player) => {
            try {
                const cachedMember = player.DiscID ? guild.members.cache.get(player.DiscID) : null;
                
                if (!cachedMember) {
                    return;
                }

                const res = await syncPlayerProfile(guild, player, cachedMember);
                if (res.roleSuccess) rolesUpdated++;
                if (res.nameSuccess) namesUpdated++;
            } catch (err) {
                errors++;
            } finally {
                processed++;
            }
        }));

        // Обновление прогресса каждые 3 секунды или в самом конце
        if (Date.now() - lastUpdateUI > 3000 || processed === totalPlayers) {
            lastUpdateUI = Date.now();
            const percent = Math.round((processed / totalPlayers) * 100);
            
            const filled = Math.round(percent / 5);
            const progressBar = '█'.repeat(filled) + '░'.repeat(20 - filled);

            const progressEmbed = new EmbedBuilder()
                .setTitle('⚙️ Выполняется синхронизация...')
                .setColor('#3498db')
                .addFields(
                    { name: 'Прогресс', value: `\`[${progressBar}]\` **${percent}%** (${processed}/${totalPlayers})` },
                    { name: 'Успешно ролей', value: `✅ ${rolesUpdated}`, inline: true },
                    { name: 'Успешно никнеймов', value: `🏷️ ${namesUpdated}`, inline: true },
                    { name: 'Пропуски / Ошибки', value: `⚠️ ${errors}`, inline: true }
                )
                .setFooter({ text: 'Процесс идет в фоновом режиме, бот работает штатно.' });

            await interaction.editReply({ embeds: [progressEmbed] });
        }

        if (i + CHUNK_SIZE < totalPlayers) {
            await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
        }
    }

    const durationSeconds = Math.round((Date.now() - startTime) / 1000);

    // 4. Финальный отчет
    const finalEmbed = new EmbedBuilder()
        .setTitle('✅ Массовая синхронизация завершена!')
        .setColor('#2ecc71')
        .addFields(
            { name: 'Всего обработано из БД', value: `\`${totalPlayers}\``, inline: true },
            { name: 'Обновлено ролей', value: `\`${rolesUpdated}\``, inline: true },
            { name: 'Обновлено ников', value: `\`${namesUpdated}\``, inline: true },
            { name: 'Затраченное время', value: `⏱️ **${durationSeconds} сек.**`, inline: true }
        )
        .setTimestamp();

    await sendLog('INFO', 'BulkSync', `Администратор \`${interaction.user.tag}\` выполнил синхронизацию ${totalPlayers} участников за ${durationSeconds}сек.`);
    await interaction.editReply({ embeds: [finalEmbed] });
}