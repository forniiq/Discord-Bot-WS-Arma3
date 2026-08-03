import { RANKS_DATA } from '../config/ranks';

export interface ExpOperationResult {
    newRankIndex: number;
    newExp: number;
    rankChanged: boolean;
}

// Списывает EXP у ученика с каскадным понижением звания при нехватке опыта.
export function deductExpWithRankDemotion(
    currentRankIndex: number, 
    currentExp: number, 
    cost: number
): ExpOperationResult {
    // Безопасно получаем текущее звание (с фоллбэком на 0-е, если индекс некорректный)
    const currentRank = RANKS_DATA[currentRankIndex] || RANKS_DATA[0];
    
    // Если по какой-то причине RANKS_DATA пуст, возвращаем дефолт
    if (!currentRank) {
        return { newRankIndex: 0, newExp: 0, rankChanged: false };
    }

    // 1. Вычисляем общий (абсолютный) опыт игрока от самого начала
    let totalExp = currentRank.exp + currentExp;

    // 2. Вычитаем стоимость экзамена
    totalExp -= cost;
    if (totalExp < 0) totalExp = 0; // Ниже 0 опыта упасть нельзя

    // 3. Находим новое звание, которому соответствует получившийся абсолютный опыт
    let newRankIndex = 0;
    for (let i = RANKS_DATA.length - 1; i >= 0; i--) {
        const rank = RANKS_DATA[i];
        if (rank && totalExp >= rank.exp) {
            newRankIndex = i;
            break;
        }
    }

    // 4. Остаток опыта внутри этого нового звания
    const targetRank = RANKS_DATA[newRankIndex];
    const newRankBaseExp = targetRank ? targetRank.exp : 0;
    const finalExp = totalExp - newRankBaseExp;

    return {
        newRankIndex,
        newExp: finalExp,
        rankChanged: newRankIndex !== currentRankIndex
    };
}

// Добавляет EXP инструктору с каскадным повышением звания при достижении порога.
export function addExpWithRankPromotion(
    currentRankIndex: number,
    currentExp: number,
    gainedExp: number
): ExpOperationResult {
    let rIndex = currentRankIndex;
    let exp = currentExp + gainedExp;

    // Проверяем, есть ли следующее звание и достигнут ли порог для повышения
    while (rIndex + 1 < RANKS_DATA.length) {
        const nextRank = RANKS_DATA[rIndex + 1];
        if (!nextRank || nextRank.exp === 0) break; // Защита от максимального звания или отсутствия данных

        if (exp >= nextRank.exp) {
            exp -= nextRank.exp; // Вычитаем порог звания
            rIndex++;            // Повышаем звание
        } else {
            break;
        }
    }

    return {
        newRankIndex: rIndex,
        newExp: exp,
        rankChanged: rIndex !== currentRankIndex
    };
}