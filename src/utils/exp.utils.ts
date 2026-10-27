import { RANKS_DATA } from '../config/ranks';

export interface ExpOperationResult {
    newRankIndex: number;
    newExp: number;
    rankChanged: boolean;
}

export function deductExpWithRankDemotion(
    currentRankIndex: number,
    currentExp: number,
    cost: number
): ExpOperationResult {
    let rankIndex = currentRankIndex;
    let exp = currentExp;
    let remaining = cost;

    while (remaining > 0) {
        if (exp >= remaining) {
            exp -= remaining;
            remaining = 0;
            break;
        }

        remaining -= exp;

        if (rankIndex <= 1) {
            rankIndex = 1;
            exp = 0;
            remaining = 0;
            break;
        }

        rankIndex--;

        const nextRankCost = RANKS_DATA[rankIndex + 1]?.exp ?? 0;
        exp = nextRankCost;
    }

    return {
        newRankIndex: rankIndex,
        newExp: exp,
        rankChanged: rankIndex !== currentRankIndex
    };
}

export function addExpWithRankPromotion(
    currentRankIndex: number,
    currentExp: number,
    gainedExp: number
): ExpOperationResult {
    let rankIndex = currentRankIndex;
    let exp = currentExp + gainedExp;

    while (rankIndex + 1 < RANKS_DATA.length) {
        const nextRank = RANKS_DATA[rankIndex + 1];
        if (!nextRank) break;

        const required = nextRank.exp;

        if (exp >= required) {
            exp -= required;
            rankIndex++;
        } else {
            break;
        }
    }

    return {
        newRankIndex: rankIndex,
        newExp: exp,
        rankChanged: rankIndex !== currentRankIndex
    };
}