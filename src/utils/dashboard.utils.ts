import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { PlayerInfo } from '@/database/queries';
import {
    RANKS,
    TOGGLE_CATEGORIES,
    ADMIN_LEVELS,
    BOSS_CATEGORIES
} from '@/config/edit-сategories';

import { UNITS } from '@/config/roles-сonfig';
import { parseArmaArray } from './array-parser.utils';
import { formatPlayerTime } from '@/utils/array-parser.utils';

export function buildPlayerDashboard(player: PlayerInfo) {
    const rankName = RANKS[parseInt(player.pLvl, 10)] || `Уровень ${player.pLvl}`;
    const unitName = UNITS[player.pUnits] || `Код отряда: ${player.pUnits}`;

    const formatToggles = (dbString: string, options: string[]) => {
        const flags = parseArmaArray(dbString);
        const active = options.filter((_, idx) => flags[idx] === 1);
        return active.length > 0 ? active.join(', ') : '❌ Нет';
    };

    const adminArray = parseArmaArray(player.pAdmin);
    const adminLevel = adminArray[0] ?? 0;
    const expBonus = adminArray[3] ?? 0;
    const playerTime = formatPlayerTime(player.pTime);
    const bossArray = parseArmaArray(player.pBoss);

    const bossDescription = BOSS_CATEGORIES.map(({ index, label, options }) => {
        const value = bossArray[index] ?? 0;
        const selected = options.find(option => option.value === value);

        return `**${label}:** ${selected?.label ?? 'Не задано'}`;
    }).join('\n');

    const embed = new EmbedBuilder()
        .setTitle(`👤 Профиль игрока: ${player.pName}`)
        .setColor(0x2b2d31)
        .addFields(
            { 
                name: '🆔 Идентификаторы', 
                value: `**pUID:** \`${player.pUID}\`\n**Discord ID:** ${player.DiscID ? `<@${player.DiscID}>` : 'Не привязан'}`, 
                inline: true 
            },
            { 
                name: '🪖 Статус', 
                value: `**Звание:** ${rankName}\n**Отряд:** ${unitName}`, 
                inline: true 
            },
            { 
                name: '📊 Статистика', 
                value: `**Опыт:** ${player.pExp}\n**Карма:** ${player.pKarma}\n**Буст опыта:** ${expBonus}`, 
                inline: true 
            },
            {
                name: '⏱️ Время на сервере',
                value: [
                    `**Общее время:** ${playerTime[0]}`,
                    `**ВВС:** ${playerTime[1]}`,
                    `**БТВ:** ${playerTime[2]}`,
                    `**ВМФ:** ${playerTime[3]}`,
                    `**Повстанец:** ${playerTime[4]}`,
                    `**Медик:** ${playerTime[5]}`
                ].join('\n'),
                inline: false
            },

            ...(adminLevel > 0 ? [{
                name: '🛡️ Администрация',
                value: `**Уровень:** ${ADMIN_LEVELS[String(adminLevel)] ?? `Уровень ${adminLevel}`}`,
                inline: false
            }] : []),

            {
                name: '👔 Должности и руководство',
                value: bossDescription,
                inline: false,
            },

            { 
                name: '🏷️ Кастомный префикс', 
                value: `\`${player.pTitle || 'Отсутствует'}\``, 
                inline: false 
            },
            { 
                name: '🛩️ ВВС', 
                value: formatToggles(player.pCYP, TOGGLE_CATEGORIES.vvs.options), 
                inline: true 
            },
            { 
                name: '🚜 БТВ', 
                value: formatToggles(player.pBTV, TOGGLE_CATEGORIES.btv.options), 
                inline: true 
            },
            { 
                name: '🧭 РП', 
                value: formatToggles(player.pRP, TOGGLE_CATEGORIES.rp.options), 
                inline: true 
            },
            { 
                name: '📍 Инструктора', 
                value: formatToggles(player.pKMB, TOGGLE_CATEGORIES.kmb.options), 
                inline: false 
            },
            { 
                name: '📼 Курсы', 
                value: formatToggles(player.pSkill, TOGGLE_CATEGORIES.courses.options), 
                inline: false 
            }
        )
        .setFooter({ text: 'Используйте элементы управления ниже для быстрого редактирования' });

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`edit_select_category:${player.pUID}`)
        .setPlaceholder('⚙️ Выберите раздел для редактирования...')
        .addOptions(
            { label: '📝 Сменить Никнейм / Опыт / Карму', value: 'modal_main', emoji: '📝' },
            { label: '🪖 Сменить Звание', value: 'select_rank', emoji: '🪖' },
            { label: '📡 Сменить Отряд', value: 'select_unit', emoji: '📡' },
            { label: '🏷️ Изменить кастомный префикс (pTitle)', value: 'edit_title', emoji: '🏷️' },
            { label: '🛩️ Допуски ВВС (Флажки)', value: 'vvs', emoji: '🛩️' },
            { label: '🚜 Допуски БТВ (Флажки)', value: 'btv', emoji: '🚜' },
            { label: '🧭 Допуски РП (Флажки)', value: 'rp', emoji: '🧭' },
            { label: '📍 Инструктора (Флажки)', value: 'kmb', emoji: '📍' },
            { label: '📼 Курсы (Флажки)', value: 'courses', emoji: '📼' },
            { label: '👑 Адм. Начи / Руководство', value: 'boss', emoji: '👑' },
            {
                label: '🛡️ Админ-права',
                description: 'Уровень администрации, ВП-панель и бонус к опыту',
                value: 'admin',
                emoji: '🛡️'
            },
            {
                label: '⏱️ Время на сервере',
                description: 'Изменить общее время и время по направлениям',
                value: 'edit_time',
                emoji: '⏱️'
            },
            {
                label: '👔 Начальники',
                description: 'Назначить должности в личном составе, ВВС, БТВ и РП',
                value: 'edit_boss',
                emoji: '👔'
            }
        );

    const row1 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    return { embeds: [embed], components: [row1] };
}