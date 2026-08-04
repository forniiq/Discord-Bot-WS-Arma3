import { EmbedBuilder } from 'discord.js';
import { PlayerInfo } from '@/database/queries';
import { RANKS_DATA } from '@/config/ranks';
import { UNITS, TOGGLE_CATEGORIES } from '@/config/roles-сonfig';
import { parseArmaArray } from '@/utils/array-parser.utils';

export function formatPlayerProfileEmbed(player: PlayerInfo, discordUserTag: string, avatarUrl: string): EmbedBuilder {
    // 1. Расчет звания и опыта
    const rankIndex = parseInt(player.pLvl, 10) || 0;
    const currentRankObj = RANKS_DATA[rankIndex] || { name: 'Неизвестно', exp: 0, shortName: 'Н/Д' };
    const nextRankObj = RANKS_DATA[rankIndex + 1];

    let progressText = 'Максимальное звание достигнуто! 👑';
    if (nextRankObj) {
        const currentExp = player.pExp || 0;
        // Если в RANKS_DATA хранятся пороги для перехода на следующий ранг:
        const requiredExp = nextRankObj.exp; 
        
        // Защита от деления на ноль и некорректных данных
        const diffTotal = Math.max(1, requiredExp);
        const diffCurrent = Math.min(Math.max(0, currentExp), diffTotal);
        
        const percentage = diffTotal > 0 ? diffCurrent / diffTotal : 0;
        
        const filledBlocks = Math.round(percentage * 10);
        const emptyBlocks = 10 - filledBlocks;
        const progressBar = '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);
        
        progressText = `\`${progressBar}\` **${Math.round(percentage * 100)}%**\n` +
            `📊 Опыт: \`${currentExp.toLocaleString()}\` / \`${requiredExp.toLocaleString()}\` XP`;
    }

    // 2. Отряд
    const unitName = UNITS[player.pUnits] || player.pUnits || 'Не назначен';

    // 3. Форматирование допусков (ВВС, БТВ, РП, Инструктора, Курсы, Админка)
    function parseCategoryString(columnValue: string | null | undefined, configKey: keyof typeof TOGGLE_CATEGORIES): string {
        const flags = parseArmaArray(columnValue);
        const catConfig = TOGGLE_CATEGORIES[configKey];
        if (!catConfig) return 'Отсутствуют';

        const activeItems: string[] = [];
        flags.forEach((val, idx) => {
            if (val === 1 && catConfig.options[idx]) {
                activeItems.push(`• ${catConfig.options[idx]}`);
            }
        });

        return activeItems.length > 0 ? activeItems.join('\n') : 'Нет допусков';
    }

    const vvsList = parseCategoryString(player.pCYP, 'vvs');
    const btvList = parseCategoryString(player.pBTV, 'btv');
    const rpList = parseCategoryString(player.pRP, 'rp');
    const kmbList = parseCategoryString(player.pKMB, 'kmb');
    const coursesList = parseCategoryString(player.pSkill, 'courses');
    const bossList = parseCategoryString(player.pBoss, 'boss');

    const embed = new EmbedBuilder()
        .setTitle(`🎖️ ВОЕННЫЙ БИЛЕТ БОЙЦА`)
        .setAuthor({ name: player.pName, iconURL: avatarUrl })
        .setDescription(
            `### 👤 Основная информация\n` +
            `• **Игровой ник:** \`${player.pName}\`\n` +
            `• **SteamID (pUID):** \`${player.pUID}\`\n` +
            `• **Discord:** ${player.DiscID ? `<@${player.DiscID}>` : 'Не привязан'}\n` +
            `• **Отряд:** \`${unitName}\`\n` +
            `• **Звание:** \`${currentRankObj.name}\` (Уровень: ${rankIndex})\n\n` +
            `### 📈 Шкала прогресса опыта\n` +
            `${progressText}\n`
        )
        .addFields(
            { name: '✈️ Допуски ВВС', value: vvsList, inline: true },
            { name: '🛡️ Допуски БТВ', value: btvList, inline: true },
            { name: '🧭 РП Стороны', value: rpList, inline: true },
            { name: '📋 Инструкторства (КМБ)', value: kmbList, inline: true },
            { name: '🎓 Курсы и Навыки', value: coursesList, inline: true },
            { name: '⚙️ Полномочия / Админка', value: bossList, inline: true }
        )
        .setColor('#3b82f6') // Синий тактический стиль
        .setFooter({ text: `Запрос от пользователя: ${discordUserTag} • War Spectra Database` })
        .setTimestamp();

    return embed;
}