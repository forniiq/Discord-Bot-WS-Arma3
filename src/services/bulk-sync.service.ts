import { EmbedBuilder } from 'discord.js';
import { findAllSyncablePlayers } from '@/database/queries';
import { syncPlayerProfile } from '@/services/player-sync.service';
import { sendLog } from '@/utils/logger.utils'; 

export async function runBulkSync(guild: any, interaction: any) {
    const startTime = Date.now();

    // 1. Первичный статус
    const initialEmbed = new EmbedBuilder()
        .setTitle('🔄 Запуск массовой синхронизации...')
        .setDescription('📡 Кэширование всех участников Discord сервера...')
        .setColor('#e67e22');

    await interaction.editReply({ 
        content: null, 
        embeds: [initialEmbed], 
        components: [] 
    });

    // 2. БЕЗОПАСНАЯ загрузка всех участников гильдии в кэш
    try {
        await guild.members.fetch({ query: '', time: 60_000 });
    } catch (err) {
        console.error('Ошибка массового кэширования гильдии:', err);
    }

    const allDbPlayers = await findAllSyncablePlayers();
    
    // ФИЛЬТРАЦИЯ: Обрабатываем ТОЛЬКО тех, кто сейчас есть на сервере
    const targetPlayers = allDbPlayers.filter(p => p.DiscID && guild.members.cache.has(p.DiscID));
    const totalPlayers = targetPlayers.length;

    if (totalPlayers === 0) {
        const noDataEmbed = new EmbedBuilder()
            .setTitle('⚠️ Синхронизация не требуется')
            .setDescription('Не найдено совпадений между участниками Discord-сервера и привязанными аккаунтами в БД.')
            .setColor('#f1c40f');

        return void interaction.editReply({ embeds: [noDataEmbed] });
    }

    let processed = 0;
    let rolesUpdated = 0;
    let namesUpdated = 0;
    let errors = 0;
    let skipped = 0;

    // Безопасные лимиты Discord API для массовых правко ролей/ников (5 запросов раз в 1.2 сек)
    const CHUNK_SIZE = 5;
    const DELAY_MS = 1200;

    let lastUpdateUI = Date.now();

    for (let i = 0; i < totalPlayers; i += CHUNK_SIZE) {
        const chunk = targetPlayers.slice(i, i + CHUNK_SIZE);

        await Promise.all(chunk.map(async (player) => {
            try {
                // Извлекаем участника строго из уже загруженного кэша
                const cachedMember = guild.members.cache.get(player.DiscID!);
                
                if (!cachedMember) {
                    skipped++;
                    return;
                }

                // Передаем гарантированно существующий cachedMember, чтобы syncPlayerProfile НЕ делал fetch()
                const res = await syncPlayerProfile(guild, player, cachedMember);
                if (res.roleSuccess) rolesUpdated++;
                if (res.nameSuccess) namesUpdated++;
                if (!res.roleSuccess && !res.nameSuccess) skipped++;
            } catch (err) {
                errors++;
            } finally {
                processed++;
            }
        }));

        // Обновляем прогресс-бар в дискорде раз в 3.5 секунды
        if (Date.now() - lastUpdateUI > 3500 || processed === totalPlayers) {
            lastUpdateUI = Date.now();
            const percent = Math.round((processed / totalPlayers) * 100);
            
            const filled = Math.round(percent / 5);
            const progressBar = '█'.repeat(filled) + '░'.repeat(20 - filled);

            const progressEmbed = new EmbedBuilder()
                .setTitle('⚙️ Выполняется массовая синхронизация...')
                .setColor('#3498db')
                .addFields(
                    { name: 'Прогресс', value: `\`[${progressBar}]\` **${percent}%** (${processed}/${totalPlayers})` },
                    { name: 'Изменено ролей', value: `✅ \`${rolesUpdated}\``, inline: true },
                    { name: 'Изменено ников', value: `🏷️ \`${namesUpdated}\``, inline: true },
                    { name: 'Без изменений', value: `⏭️ \`${skipped}\``, inline: true },
                    { name: 'Ошибки API', value: `⚠️ \`${errors}\``, inline: true }
                )
                .setFooter({ text: 'Синхронизация выполняется в фоновом режиме...' });

            await interaction.editReply({ embeds: [progressEmbed] }).catch(() => {});
        }

        if (i + CHUNK_SIZE < totalPlayers) {
            await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
        }
    }

    const durationSeconds = Math.round((Date.now() - startTime) / 1000);

    // 3. Финальный ответ в чат
    const finalEmbed = new EmbedBuilder()
        .setTitle('✅ Массовая синхронизация завершена!')
        .setColor('#2ecc71')
        .setDescription(`Операция успешно завершена по инициативе ${interaction.user}.`)
        .addFields(
            { name: 'Обработано участников', value: `\`${totalPlayers}\``, inline: true },
            { name: 'Обновлено ролей', value: `\`${rolesUpdated}\``, inline: true },
            { name: 'Обновлено ников', value: `\`${namesUpdated}\``, inline: true },
            { name: 'Без изменений', value: `\`${skipped}\``, inline: true },
            { name: 'Ошибки', value: `\`${errors}\``, inline: true },
            { name: 'Время выполнения', value: `⏱️ **${durationSeconds} сек.**`, inline: true }
        )
        .setTimestamp();

    await interaction.editReply({ 
        content: `🔔 ${interaction.user}, массовая синхронизация завершена!`, 
        embeds: [finalEmbed] 
    });

    // 4. Лог операции
    await sendLog(
        'INFO', 
        'BulkSync', 
        `Администратор \`${interaction.user.tag}\` (${interaction.user.id}) выполнил массовую синхронизацию (${totalPlayers} участников) за ${durationSeconds} сек.`
    );
}