// Генератор Дашборда Profile Embed

import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { PlayerInfo } from '@/database/queries';
import { RANKS, UNITS, TOGGLE_CATEGORIES } from '@/config/editCategories';
import { parseArmaArray } from './arrayParser';

export function buildPlayerDashboard(player: PlayerInfo) {
    const rankName = RANKS[parseInt(player.pLvl, 10)] || `Уровень ${player.pLvl}`;
    const unitName = UNITS[player.pUnits] || `Код отряда: ${player.pUnits}`;

    const formatToggles = (dbString: string, options: string[]) => {
        const flags = parseArmaArray(dbString);
        const active = options.filter((_, idx) => flags[idx] === 1);
        return active.length > 0 ? active.join(', ') : '❌ Нет';
    };

    const embed = new EmbedBuilder()
        .setTitle(`👤 Профиль игрока: ${player.pName}`)
        .setColor(0x2b2d31)
        .addFields(
            { name: '🆔 Идентификаторы', value: `**pUID:** \`${player.pUID}\`\n**Discord ID:** ${player.DiscID ? `<@${player.DiscID}>` : 'Не привязан'}`, inline: true },
            { name: '🪖 Статус', value: `**Звание:** ${rankName}\n**Отряд:** ${unitName}`, inline: true },
            { name: '📊 Статистика', value: `**Опыт:** ${player.pExp}\n**Карма:** ${player.pKarma}`, inline: true },
            { name: '🛩️ ВВС', value: formatToggles(player.pCYP, TOGGLE_CATEGORIES.vvs.options), inline: true },
            { name: '🚜 БТВ', value: formatToggles(player.pBTV, TOGGLE_CATEGORIES.btv.options), inline: true },
            { name: '🧭 РП', value: formatToggles(player.pRP, TOGGLE_CATEGORIES.rp.options), inline: true },
            { name: '📍 Инструктора', value: formatToggles(player.pKMB, TOGGLE_CATEGORIES.kmb.options), inline: false },
            { name: '📼 Курсы', value: formatToggles(player.pSkill, TOGGLE_CATEGORIES.courses.options), inline: false }
        )
        .setFooter({ text: 'Используйте элементы управления ниже для быстрого редактирования' });

    // Меню выбора категории редактирования
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`edit_select_category:${player.pUID}`)
        .setPlaceholder('⚙️ Выберите раздел для редактирования...')
        .addOptions(
            { label: '📝 Сменить Никнейм / Опыт / Карму', value: 'modal_main', emoji: '📝' },
            { label: '🪖 Сменить Звание', value: 'select_rank', emoji: '🪖' },
            { label: '📡 Сменить Отряд', value: 'select_unit', emoji: '📡' },
            { label: '🛩️ Допуски ВВС (Флажки)', value: 'vvs', emoji: '🛩️' },
            { label: '🚜 Допуски БТВ (Флажки)', value: 'btv', emoji: '🚜' },
            { label: '🧭 Допуски РП (Флажки)', value: 'rp', emoji: '🧭' },
            { label: '📍 Инструктора (Флажки)', value: 'kmb', emoji: '📍' },
            { label: '📼 Курсы (Флажки)', value: 'courses', emoji: '📼' },
            { label: '👑 Адм. Начи / Руководство', value: 'boss', emoji: '👑' }
        );

    const row1 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    return { embeds: [embed], components: [row1] };
}