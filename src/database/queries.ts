import { Transaction, QueryTypes } from "sequelize";
import { sequelize } from "./connect";

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

export async function processExamPayment(
    studentDiscordId: string,
    instructorDiscordId: string,
    cost: number
): Promise<TransferResult> {
    const transaction: Transaction = await sequelize.transaction();

    try {
        // 1. Находим курсанта
        const students = await sequelize.query<PlayerInfo>(
            `SELECT * FROM players WHERE DiscID = :studentDiscordId AND DiscID IS NOT NULL AND DiscID != '0' AND DiscID != '' LIMIT 1`,
            { 
                replacements: { studentDiscordId }, 
                type: QueryTypes.SELECT,
                transaction 
            }
        );
        const student = students[0];

        if (!student) {
            await transaction.rollback();
            return { success: false, error: 'STUDENT_NOT_FOUND' };
        }

        if (student.pExp < cost) {
            await transaction.rollback();
            return { success: false, error: 'NOT_ENOUGH_EXP' };
        }

        // 2. Находим инструктора
        const instructors = await sequelize.query<PlayerInfo>(
            `SELECT * FROM players WHERE DiscID = :instructorDiscordId AND DiscID IS NOT NULL AND DiscID != '0' AND DiscID != '' LIMIT 1`,
            { 
                replacements: { instructorDiscordId }, 
                type: QueryTypes.SELECT,
                transaction 
            }
        );
        const instructor = instructors[0];

        if (!instructor) {
            await transaction.rollback();
            return { success: false, error: 'INSTRUCTOR_NOT_FOUND' };
        }

        const instructorExp = Math.floor(cost * 0.8);
        const bankExp = Math.ceil(cost * 0.2);

        // 3. Списываем EXP у курсанта
        await sequelize.query(
            `UPDATE players SET pExp = pExp - :cost WHERE pUID = :pUID`,
            { replacements: { cost, pUID: student.pUID }, transaction }
        );

        // 4. Начисляем EXP инструктору
        await sequelize.query(
            `UPDATE players SET pExp = pExp + :instructorExp WHERE pUID = :pUID`,
            { replacements: { instructorExp, pUID: instructor.pUID }, transaction }
        );

        // 5. Пополняем банк (создаем запись, если её ещё нет)
        await sequelize.query(
            `INSERT INTO bank (id, expBank) VALUES (1, :bankExp) 
            ON DUPLICATE KEY UPDATE expBank = expBank + :bankExp`,
            { replacements: { bankExp }, transaction }
        );

        // Фиксируем транзакцию
        await transaction.commit();

        return {
            success: true,
            studentExpLeft: student.pExp - cost,
        };
    } catch (error) {
        await transaction.rollback();
        console.error('Ошибка при проведении транзакции экзамена:', error);
        return { success: false, error: 'UNKNOWN_ERROR' };
    }
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