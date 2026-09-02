import { sequelize } from '../connect';
import { QueryTypes, Transaction } from 'sequelize';
import { addExpWithRankPromotion } from '../../utils/exp.utils';
import { getPlayerExpData, updatePlayerExpAndRankByDiscId } from './exp.queries';
import { findPlayer } from './players.queries';

export interface PromocodeData {
    Name: string;
    PromoEXP: number;
    PromoActiv: number;
    UsedUsers: string | null;
    ExpiresAt: Date | string | null;
}

export type PromoRedeemResult = 
    | { success: true; gainedExp: number; newLvl: number; newExp: number; rankChanged: boolean }
    | { success: false; error: 'NOT_FOUND' | 'INACTIVE' | 'EXPIRED' | 'ALREADY_USED' | 'PLAYER_NOT_FOUND' | 'DB_ERROR' };

// 1. Создание или обновление промокода (с опциональной датой истечения)
export async function createPromocode(
    name: string,
    exp: number,
    activations: number,
    expiresAt: Date | null = null
): Promise<boolean> {
    try {
        await sequelize.query(
            `INSERT INTO promocod (Name, PromoEXP, PromoActiv, UsedUsers, ExpiresAt) 
                VALUES (:name, :exp, :activations, '[]', :expiresAt)
                ON DUPLICATE KEY UPDATE PromoEXP = :exp, PromoActiv = :activations, ExpiresAt = :expiresAt`,
            {
                replacements: { name, exp, activations, expiresAt },
                type: QueryTypes.INSERT,
            }
        );
        return true;
    } catch (error) {
        console.error('Ошибка при создании промокода:', error);
        return false;
    }
}

// 2. Получение списка всех промокодов (для админов)
export async function getAllPromocodes(): Promise<PromocodeData[]> {
    try {
        const rows = await sequelize.query<PromocodeData>(
            `SELECT Name, 
                    CAST(PromoEXP AS DOUBLE) as PromoEXP, 
                    CAST(PromoActiv AS SIGNED) as PromoActiv, 
                    UsedUsers, 
                    ExpiresAt 
                FROM promocod 
                ORDER BY Name ASC`,
            { type: QueryTypes.SELECT }
        );
        return rows;
    } catch (error) {
        console.error('Ошибка при получении списка промокодов:', error);
        return [];
    }
}

// 3. Атомарная активация промокода
export async function redeemPromocode(discId: string, promoName: string): Promise<PromoRedeemResult> {
    const t = await sequelize.transaction();

    try {
        const player = await findPlayer({ discordId: discId });
        if (!player) {
            await t.rollback();
            return { success: false, error: 'PLAYER_NOT_FOUND' };
        }

        const promoRows = await sequelize.query<PromocodeData>(
            `SELECT Name, 
                    CAST(PromoEXP AS DOUBLE) as PromoEXP, 
                    CAST(PromoActiv AS SIGNED) as PromoActiv,
                    UsedUsers,
                    ExpiresAt
                FROM promocod WHERE Name = :name FOR UPDATE`,
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

        // Проверка даты истечения
        if (promo.ExpiresAt) {
            const expDate = new Date(promo.ExpiresAt);
            if (expDate.getTime() < Date.now()) {
                await t.rollback();
                return { success: false, error: 'EXPIRED' };
            }
        }

        // Проверка повторного использования
        let usedUsers: string[] = [];
        if (promo.UsedUsers) {
            try {
                usedUsers = JSON.parse(promo.UsedUsers);
            } catch {
                usedUsers = [];
            }
        }

        if (usedUsers.includes(discId)) {
            await t.rollback();
            return { success: false, error: 'ALREADY_USED' };
        }

        const expData = await getPlayerExpData(discId, t);
        if (!expData) {
            await t.rollback();
            return { success: false, error: 'PLAYER_NOT_FOUND' };
        }

        const calc = addExpWithRankPromotion(expData.pLvl, expData.pExp, promo.PromoEXP);
        await updatePlayerExpAndRankByDiscId(discId, calc.newRankIndex, calc.newExp, t);

        usedUsers.push(discId);

        await sequelize.query(
            'UPDATE promocod SET PromoActiv = PromoActiv - 1, UsedUsers = :usedUsers WHERE Name = :name',
            {
                replacements: { 
                    name: promoName,
                    usedUsers: JSON.stringify(usedUsers) 
                },
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