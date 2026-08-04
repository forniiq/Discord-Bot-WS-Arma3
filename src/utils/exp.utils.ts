import { RANKS_DATA } from '../config/ranks';

export interface ExpOperationResult {
    newRankIndex: number;
    newExp: number;
    rankChanged: boolean;
}

// Списывает EXP у бойца с понижением звания.
export function deductExpWithRankDemotion(
    currentRankIndex: number, 
    currentExp: number, 
    cost: number
): ExpOperationResult {
    let rIndex = currentRankIndex;
    let exp = currentExp;
    let remainingCost = cost;

    while (remainingCost > 0) {
        if (remainingCost <= exp) {
            exp -= remainingCost;
            remainingCost = 0;
        } else {
            remainingCost -= exp; // Сжигаем текущий опыт на этом звании

            if (rIndex <= 0) {
                // Ниже рядового упасть нельзя
                rIndex = 0;
                exp = 0;
                remainingCost = 0;
                break;
            }

            // Запоминаем звание, с которого падаем
            const previousRank = RANKS_DATA[rIndex];
            
            // Понижаем ранг
            rIndex--;

            // Опыт на новом пониженном звании становится равен `exp` ранга, с которого упали
            exp = previousRank ? previousRank.exp : 0;
        }
    }

    return {
        newRankIndex: rIndex,
        newExp: exp,
        rankChanged: rIndex !== currentRankIndex
    };
}

// Добавляет EXP инструктору с повышением звания.
export function addExpWithRankPromotion(
    currentRankIndex: number,
    currentExp: number,
    gainedExp: number
): ExpOperationResult {
    let rIndex = currentRankIndex;
    let exp = currentExp + gainedExp;

    // Пока можем повышаться и текущего опыта хватает на порог следующего ранга
    while (rIndex + 1 < RANKS_DATA.length) {
        const nextRank = RANKS_DATA[rIndex + 1]; // Следующий ранг и его требуемый exp (порог)
        
        if (nextRank && exp >= nextRank.exp) {
            exp -= nextRank.exp; // Вычитаем порог перехода, излишек идет дальше
            rIndex++;            // Повышаем ранг
        } else {
            break;
        }
    }

    // Защита от выхода за пределы максимального звания в массиве
    if (rIndex >= RANKS_DATA.length - 1) {
        rIndex = RANKS_DATA.length - 1;
        // Если это максимальное звание, опыт может копиться бесконечно или упираться в лимит, 
        // оставляем как есть.
    }

    return {
        newRankIndex: rIndex,
        newExp: exp,
        rankChanged: rIndex !== currentRankIndex
    };
}