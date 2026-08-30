import { sequelize } from '../connect';
import { QueryTypes, Transaction } from 'sequelize';
import { addExpWithRankPromotion } from '../../utils/exp.utils';
import { getPlayerExpData, updatePlayerExpAndRankByDiscId } from './exp.queries';
import { findPlayer } from './players.queries';

export interface PromocodeData {
    Name: string;
    PromoEXP: number;
    PromoActiv: number;
}

export type PromoRedeemResult = 
    | { success: true; gainedExp: number; newLvl: number; newExp: number; rankChanged: boolean }
    | { success: false; error: 'NOT_FOUND' | 'INACTIVE' | 'PLAYER_NOT_FOUND' | 'DB_ERROR' };

// 1. Создание промокода (или обновление существующего)
export async function createPromocode(
    name: string,
    exp: number,
    activations: number
): Promise<boolean> {
    try {
        await sequelize.query(
            `INSERT INTO promocod (Name, PromoEXP, PromoActiv) 
                VALUES (:name, :exp, :activations)
                ON DUPLICATE KEY UPDATE PromoEXP = :exp, PromoActiv = :activations`,
            {
                replacements: { name, exp, activations },
                type: QueryTypes.INSERT,
            }
        );
        return true;
    } catch (error) {
        console.error('Ошибка при создании промокода:', error);
        return false;
    }
}

// 2. Получение информации о промокоде
export async function getPromocode(name: string, transaction?: Transaction): Promise<PromocodeData | null> {
    const rows = await sequelize.query<PromocodeData>(
        'SELECT Name, CAST(PromoEXP AS DOUBLE) as PromoEXP, CAST(PromoActiv AS SIGNED) as PromoActiv FROM promocod WHERE Name = :name LIMIT 1',
        {
            replacements: { name },
            type: QueryTypes.SELECT,
            transaction
        }
    );
    return rows[0] ?? null;
}

// 3. Атомарное использование промокода
export async function redeemPromocode(discId: string, promoName: string): Promise<PromoRedeemResult> {
    const t = await sequelize.transaction();

    try {
        // Проверяем игрока
        const player = await findPlayer({ discordId: discId });
        if (!player) {
            await t.rollback();
            return { success: false, error: 'PLAYER_NOT_FOUND' };
        }

        // Проверяем промокод с блокировкой строки для исключения Race Condition
        const promoRows = await sequelize.query<PromocodeData>(
            'SELECT Name, CAST(PromoEXP AS DOUBLE) as PromoEXP, CAST(PromoActiv AS SIGNED) as PromoActiv FROM promocod WHERE Name = :name FOR UPDATE',
            {
                replacements: { name: promoName },
                type: QueryTypes.SELECT,
                transaction: t
            }
        );

        const promo = promoRows[0];
        if (!promo) {
            await t.rollback();
            return { success: false, error: 'NOT_FOUND' };
        }

        if (promo.PromoActiv <= 0) {
            await t.rollback();
            return { success: false, error: 'INACTIVE' };
        }

        // Получаем текущие уровень и опыт игрока
        const expData = await getPlayerExpData(discId, t);
        if (!expData) {
            await t.rollback();
            return { success: false, error: 'PLAYER_NOT_FOUND' };
        }

        // Рассчитываем повышение
        const calc = addExpWithRankPromotion(expData.pLvl, expData.pExp, promo.PromoEXP);

        // Обновляем опыт и звание игрока
        await updatePlayerExpAndRankByDiscId(discId, calc.newRankIndex, calc.newExp, t);

        // Уменьшаем количество оставшихся активаций промокода
        await sequelize.query(
            'UPDATE promocod SET PromoActiv = PromoActiv - 1 WHERE Name = :name',
            {
                replacements: { name: promoName },
                type: QueryTypes.UPDATE,
                transaction: t
            }
        );

        await t.commit();

        return {
            success: true,
            gainedExp: promo.PromoEXP,
            newLvl: calc.newRankIndex,
            newExp: calc.newExp,
            rankChanged: calc.rankChanged
        };
    } catch (error) {
        await t.rollback();
        console.error('Ошибка при активации промокода:', error);
        return { success: false, error: 'DB_ERROR' };
    }
}