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
    let rIndex = currentRankIndex;
    let exp = currentExp;
    let needed = cost;

    while (needed > exp) {
        if (rIndex <= 0) {
            // Если дошли до Новобранца (0 звание), опыт становится 0
            return { newRankIndex: 0, newExp: 0, rankChanged: rIndex !== currentRankIndex };
        }

        needed -= exp; // Покрываем часть долга накопленным опытом звания
        rIndex--;      // Понижаем звание на 1 уровень

        const targetRank = RANKS_DATA[rIndex];
        exp = targetRank ? targetRank.exp : 0; // Накопленный опыт для звания
    }

    exp -= needed;

    return {
        newRankIndex: rIndex,
        newExp: exp,
        rankChanged: rIndex !== currentRankIndex
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