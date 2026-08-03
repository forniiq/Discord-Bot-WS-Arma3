import { EmbedBuilder } from 'discord.js';
import { findAllSyncablePlayers } from '@/database/queries';
import { syncPlayerProfile } from '@/services/player-sync.service';
import { sendLog } from '@/utils/logger.utils'; 

export async function runBulkSync(guild: any, interaction: any) {
    const startTime = Date.now();

    // 1. Первичный статус
    const initialEmbed = new EmbedBuilder()
        .setTitle('🔄 Запуск массовой синхронизации...')
        .setDescription('📡 Загрузка кэша участников сервера и записей из БД...')
        .setColor('#e67e22');

    await interaction.editReply({ 
        content: null, 
        embeds: [initialEmbed], 
        components: [] 
    });

    // 2. Получение данных
    try {
        await guild.members.fetch();
    } catch (err) {
        console.error('Ошибка кэширования гильдии:', err);
    }

    const players = await findAllSyncablePlayers();
    const totalPlayers = players.length;

    if (totalPlayers === 0) {
        const noDataEmbed = new EmbedBuilder()
            .setTitle('⚠️ Синхронизация не требуется')
            .setDescription('В базе данных не найдено привязанных участников для синхронизации.')
            .setColor('#f1c40f');

        return void interaction.editReply({ embeds: [noDataEmbed] });
    }

    let processed = 0;
    let rolesUpdated = 0;
    let namesUpdated = 0;
    let errors = 0;
    let skipped = 0;

    const CHUNK_SIZE = 5;
    const DELAY_MS = 300;

    let lastUpdateUI = Date.now();

    for (let i = 0; i < totalPlayers; i += CHUNK_SIZE) {
        const chunk = players.slice(i, i + CHUNK_SIZE);

        await Promise.all(chunk.map(async (player) => {
            try {
                const cachedMember = player.DiscID ? guild.members.cache.get(player.DiscID) : null;
                
                if (!cachedMember) {
                    skipped++;
                    return;
                }

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

        if (Date.now() - lastUpdateUI > 3000 || processed === totalPlayers) {
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
                    { name: 'Без изменений / Пропущено', value: `⏭️ \`${skipped}\``, inline: true },
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
            { name: 'Всего обработано', value: `\`${totalPlayers}\``, inline: true },
            { name: 'Обновлено ролей', value: `\`${rolesUpdated}\``, inline: true },
            { name: 'Обновлено ников', value: `\`${namesUpdated}\``, inline: true },
            { name: 'Без изменений / Пропущены', value: `\`${skipped}\``, inline: true },
            { name: 'Ошибки', value: `\`${errors}\``, inline: true },
            { name: 'Время выполнения', value: `⏱️ **${durationSeconds} сек.**`, inline: true }
        )
        .setTimestamp();

    await interaction.editReply({ 
        content: `🔔 ${interaction.user}, массовая синхронизация завершена!`, 
        embeds: [finalEmbed] 
    });

    // 4. Отправка записи в логи
    await sendLog(
        'INFO', 
        'BulkSync', 
        `Администратор \`${interaction.user.tag}\` (${interaction.user.id}) выполнил массовую синхронизацию (${totalPlayers} игроков) за ${durationSeconds} сек.`
    );
}