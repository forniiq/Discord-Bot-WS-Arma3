import { Transaction, QueryTypes } from "sequelize";
import { sequelize } from "./connect";
import { RANKS_DATA, RankInfo } from "../config/ranks";

export interface OnlinePlayer {
    pName: string;
    pLvl: string;
    pLvlSort: number;
    Slot: string;
}

export interface ZBDInfo {
    City: string;
    Time: number;
    FPS: string;
}

export interface PlayerInfo {
    ID: number;
    pUID: string;
    pName: string;
    pLvl: string;
    pExp: number;
    pCYP: string;   // ВВС
    pBTV: string;   // БТВ
    pRP: string;    // РП
    pKMB: string;   // КМБ Инструктора
    pSkill: string; // Курсы / Навыки
    pBoss: string;  // Адм / Руководство
    pKarma: number;
    pUnits: string;
    DiscID: string | null;
}

export interface TransferResult {
    success: boolean;
    error?: 'STUDENT_NOT_FOUND' | 'INSTRUCTOR_NOT_FOUND' | 'NOT_ENOUGH_EXP' | 'UNKNOWN_ERROR';
    studentExpLeft?: number;
    studentInitialExp?: number;
    rankChanged?: boolean;
    oldRank?: string;
    newRank?: string;
}

export interface LogZBD {
    id?: number;
    Date: string;
    City: string;
    Time: number;
    Status: number;
    CountPlayers: number;
    Count300: number;
    Count200: number;
    dCheck: number;
}

export interface UnitData {
    uUID: string;
    uName: string;
    uTag: string;
    dRoleID: string | null;
}

export interface ExamPaymentResult {
    success: boolean;
    error?: string;
    studentInitialExp?: number;
    studentExpLeft?: number;
    rankChanged?: boolean;
    oldRank?: string;
    newRank?: string;
}

export interface DemotionResult {
    willDemote: boolean;
    oldRank: string;
    newRank: string;
    finalExp: number;
    insufficientExp: boolean;
}

// Количество игроков на сервере
export async function getOnlineCount() {
    const [rows] = await sequelize.query(`
        SELECT COUNT(*) as count
        FROM players_online    
    `);

    return (rows as any)[0].count as number;
}

// Подробный онлайн игроков
export async function getOnlinePlayers(): Promise<OnlinePlayer[]> {
    const [rows] = await sequelize.query(`
        SELECT
            p.pName,
            s.pLvl,
            s.pLvlSort,
            s.Slot
        FROM stats o
        INNER JOIN players p
            ON o.pUID = p.pUID
        INNER JOIN stats s
            ON p.pName = s.pName
        ORDER BY s.pLvlSort DESC, p.pName ASC
    `);

    return rows as OnlinePlayer[];
}

// Получение текущего ЗБД
export async function getCurrentZbd(): Promise<ZBDInfo | null> {
    const [rows] = await sequelize.query(`
        SELECT
            City,
            Time,
            FPS
        FROM info
        ORDER BY Time DESC
        LIMIT 1
    `);

    const result = (rows as ZBDInfo[])[0];

    return result ?? null;
}

// Поиск игрока
export async function findPlayer(search: {
    steamId?: string;
    nickname?: string;
    discordId?: string;
    discId?: string;
}): Promise<PlayerInfo | null> {
    const replacements: Record<string, string> = {};
    let whereClause: string | null = null;

    const targetDiscordId = search.discordId || search.discId;

    if (search.steamId) {
        whereClause = "pUID = :value";
        replacements.value = search.steamId;
    } else if (search.nickname) {
        whereClause = "pName = :value";
        replacements.value = search.nickname;
    } else if (targetDiscordId) {
        whereClause = "DiscID = :value AND DiscID IS NOT NULL AND DiscID != '0' AND DiscID != ''";
        replacements.value = targetDiscordId;
    } else {
        return null;
    }

    const [rows] = await sequelize.query(
        `SELECT * FROM players WHERE ${whereClause} LIMIT 1`,
        { replacements }
    );

    return (rows as PlayerInfo[])[0] ?? null;
}

export async function updatePlayerField(pUID: string, field: string, value: any): Promise<boolean> {
    try {
        await sequelize.query(
            `UPDATE players SET ${field} = :value WHERE pUID = :pUID`,
            { replacements: { value, pUID } }
        );
        return true;
    } catch (e) {
        console.error("Ошибка при обновлении игрока:", e);
        return false;
    }
}

// Получение всех игроков с привязанным DiscordID для массовой синхронизации
export async function findAllSyncablePlayers(): Promise<PlayerInfo[]> {
    const [rows] = await sequelize.query(`
        SELECT * FROM players 
        WHERE DiscID IS NOT NULL 
            AND DiscID != '0' 
            AND DiscID != ''
    `);

    return rows as PlayerInfo[];
}

export function calculateRankDemotion(currentExp: number, currentRankName: string, cost: number): DemotionResult {
    let expLeft = currentExp - cost;
    let rankName = currentRankName;
    const initialRank = currentRankName;
    let rankChanged = false;

    while (expLeft < 0) {
        const currentRankIndex = RANKS_DATA.findIndex(
            r => r.name === rankName || r.fullName === rankName || r.shortName === rankName
        );
        if (currentRankIndex <= 0) break; // Мы на самом нижнем ранге, дальше понижать некуда

        const prevRank = RANKS_DATA[currentRankIndex - 1];
        if (!prevRank) break; // Защита для TS

        expLeft += prevRank.exp; // Используем правильное поле .exp из RankInfo
        rankName = prevRank.name;
        rankChanged = true;
    }

    if (expLeft < 0) {
        return {
            insufficientExp: true,
            willDemote: false,
            oldRank: initialRank,
            newRank: rankName,
            finalExp: currentExp
        };
    }

    return {
        insufficientExp: false,
        willDemote: rankChanged,
        oldRank: initialRank,
        newRank: rankName,
        finalExp: expLeft
    };
}

export async function processExamPayment(studentDiscordId: string, instructorDiscordId: string, cost: number) {
    const student = await findPlayer({ discordId: studentDiscordId });
    const instructor = await findPlayer({ discordId: instructorDiscordId });

    if (!student || !student.DiscID) return { success: false, error: 'STUDENT_NOT_FOUND' };
    if (!instructor || !instructor.DiscID) return { success: false, error: 'INSTRUCTOR_NOT_FOUND' };

    const studentCurrentExp = Number(student.pExp) || 0;
    const demotion: DemotionResult = calculateRankDemotion(studentCurrentExp, student.pLvl, cost);

    if (demotion.insufficientExp) {
        return { success: false, error: 'NOT_ENOUGH_EXP' };
    }

    const initialExp = studentCurrentExp;
    const instructorReward = Math.floor(cost * 0.8);

    // Обновляем опыт и ранг курсанта
    await updatePlayerField(student.DiscID, 'pExp', demotion.finalExp);
    if (demotion.willDemote) {
        await updatePlayerField(student.DiscID, 'pLvl', demotion.newRank);
    }

    // Начисляем опыт инструктору (80%)
    const newInstructorExp = (Number(instructor.pExp) || 0) + instructorReward;
    await updatePlayerField(instructor.DiscID, 'pExp', newInstructorExp);

    // Вычисляем комиссию в банк (20%) и пополняем expBank в БД
    const bankExp = Math.ceil(cost * 0.2);
    await sequelize.query(
        'UPDATE bank SET expBank = expBank + :bankExp LIMIT 1',
        { replacements: { bankExp }, type: QueryTypes.UPDATE }
    ).catch(() => null);

    return {
        success: true,
        rankChanged: demotion.willDemote,
        oldRank: demotion.oldRank,
        newRank: demotion.newRank,
        studentInitialExp: initialExp,
        studentExpLeft: demotion.finalExp
    };
}

// Получение последнего необработанного ЗБД (dCheck = 0)
export async function getLastUnprocessedZbd(): Promise<LogZBD | null> {
    const [rows] = await sequelize.query(`
        SELECT * FROM log_zbd
        WHERE dCheck = 0
        ORDER BY Date DESC
        LIMIT 1
    `);

    const results = rows as LogZBD[];
    return results[0] ?? null;
}

// Пометка ЗБД как обработанного
export async function markZbdProcessed(date: string): Promise<void> {
    await sequelize.query(
        `UPDATE log_zbd SET dCheck = 1 WHERE Date <= :date AND dCheck = 0`,
        { replacements: { date } }
    );
}

// Вспомогательная функция: помечает ВСЕ старые записи как пропущенные/проверенные,
// чтобы при первом запуске бота не отправлялись древние логи.
export async function markAllOldZbdProcessed(): Promise<void> {
    await sequelize.query(`UPDATE log_zbd SET dCheck = 1 WHERE dCheck = 0`);
}

export async function isOperator(discordId: string): Promise<boolean> {
    try {
        const [rows] = await sequelize.query(
            `SELECT discord_id FROM operators WHERE discord_id = :discordId LIMIT 1`,
            { replacements: { discordId } }
        );

        return (rows as any[]).length > 0;
    } catch (error) {
        console.error("Ошибка при проверке прав оператора:", error);
        return false;
    }
}

export async function getBankBalance(): Promise<number> {
    try {
        const [rows] = await sequelize.query(`
            SELECT expBank FROM bank WHERE id = 1 LIMIT 1
        `);
        const result = (rows as any[])[0];
        return result ? Number(result.expBank) : 0;
    } catch (error) {
        console.error("Ошибка при получении баланса банка:", error);
        return 0;
    }
}

export async function getAllUnits(): Promise<UnitData[]> {
    try {
        const [rows] = await sequelize.query(`
            SELECT uUID, uName, uTag, dRoleID 
            FROM units
        `);
        return rows as UnitData[];
    } catch (e) {
        console.error("Ошибка при получении списка отрядов:", e);
        return [];
    }
}