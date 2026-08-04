import { RANKS_DATA } from '../config/ranks';

export interface ExpOperationResult {
    newRankIndex: number;
    newExp: number;
    rankChanged: boolean;
}

//Списывает EXP у бойца с каскадным понижением звания при нехватке опыта.
export function deductExpWithRankDemotion(
    currentRankIndex: number, 
    currentExp: number, 
    cost: number
): ExpOperationResult {
    let rIndex = currentRankIndex;
    let exp = currentExp;
    let remainingCost = cost;

    // Пока стоимость больше доступного опыта на текущем звании
    while (remainingCost > exp) {
        remainingCost -= exp; // Списываем то, что было на текущем звании

        if (rIndex <= 0) {
            // Ниже Новобранца/Рядового упасть нельзя
            rIndex = 0;
            exp = 0;
            remainingCost = 0;
            break;
        }

        rIndex--; // Падаем на звание ниже
        const targetRank = RANKS_DATA[rIndex];
        
        // Новый опыт становится равен полному порогу этого звания
        exp = targetRank ? targetRank.exp : 0;
    }

    // Финальное вычитание оставшейся стоимости
    exp -= remainingCost;
    if (exp < 0) exp = 0;

    return {
        newRankIndex: rIndex,
        newExp: exp,
        rankChanged: rIndex !== currentRankIndex
    };
}

// Добавляет EXP бойцу с каскадным повышением звания при достижении порога.
export function addExpWithRankPromotion(
    currentRankIndex: number,
    currentExp: number,
    gainedExp: number
): ExpOperationResult {
    let rIndex = currentRankIndex;
    let exp = currentExp + gainedExp;

    // Цикл повышения, пока опыта хватает на следующие звания
    while (rIndex + 1 < RANKS_DATA.length) {
        const nextRank = RANKS_DATA[rIndex + 1];
        if (!nextRank) break;

        // Если текущего опыта достаточно для перехода на следующее звание
        if (exp >= nextRank.exp) {
            exp -= nextRank.exp; // Вычитаем порог нового звания (остаток переносится)
            rIndex++;            // Повышаем звание
        } else {
            break;
        }
    }

    // Защита для максимального звания (если уперлись в потолок)
    if (rIndex >= RANKS_DATA.length - 1) {
        // Ограничиваем индекс последним элементом
        rIndex = RANKS_DATA.length - 1;
    }

    return {
        newRankIndex: rIndex,
        newExp: exp,
        rankChanged: rIndex !== currentRankIndex
    };
}