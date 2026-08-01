// утилита для форматирования Embed последнего ЗБД

import { EmbedBuilder } from 'discord.js';
import type { LogZBD } from '@/database/queries';

// Перевод секунд в формат "1ч 30м 15с" или "45м 10с"
function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const parts = [];
    if (hours > 0) parts.push(`${hours}ч`);
    if (minutes > 0) parts.push(`${minutes}м`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}с`);

    return parts.join(' ');
}

export function createZbdEmbed(zbd: LogZBD): EmbedBuilder {
    const isSuccess = zbd.Status === 1;

    return new EmbedBuilder()
        .setTitle(`📊 Итоги ЗБД — ${zbd.City}`)
        .setColor(isSuccess ? '#57F287' : '#ED4245') // Зеленый для успеха, красный для провала
        .setFields(
            {
                name: '📌 Статус',
                value: isSuccess ? '✅ **Успешно завершено**' : '❌ **Провалено**',
                inline: true,
            },
            {
                name: '⏱ Длительность',
                value: formatDuration(zbd.Time),
                inline: true,
            },
            {
                name: '👥 Игроков на финише',
                value: `${zbd.CountPlayers} чел.`,
                inline: true,
            },
            {
                name: '🚑 Потери и ранения',
                value: `🩸 **300-е (Ранены):** ${zbd.Count300}\n💀 **200-е (Убиты):** ${zbd.Count200}`,
                inline: false,
            }
        )
        .setFooter({ text: `Время окончания: ${zbd.Date}` })
        .setTimestamp();
}