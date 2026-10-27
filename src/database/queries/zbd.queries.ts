import { QueryTypes } from 'sequelize';
import { sequelize } from '../connect';

export interface ZBDInfo {
    id?: number;
    Date?: string;
    City: string;
    Time: number;
    Status?: number;
    CountPlayers?: number;
    Count300?: number;
    Count200?: number;
    dCheck?: number;
    FPS?: string;
}

export type LogZBD = ZBDInfo;

export async function getLastUnprocessedZbd(): Promise<ZBDInfo | null> {
    const rows = await sequelize.query<ZBDInfo>(
        'SELECT * FROM log_zbd WHERE dCheck = 0 ORDER BY Date DESC LIMIT 1',
        { type: QueryTypes.SELECT }
    );
    return rows[0] || null;
}

export async function getCurrentZbd(): Promise<ZBDInfo | null> {
    const rows = await sequelize.query<ZBDInfo>(
        'SELECT * FROM log_zbd ORDER BY Date DESC LIMIT 1',
        { type: QueryTypes.SELECT }
    );
    return rows[0] || null;
}

export async function markZbdProcessed(date: string): Promise<void> {
    await sequelize.query(
        'UPDATE log_zbd SET dCheck = 1 WHERE Date <= :date AND dCheck = 0',
        {
            replacements: { date },
            type: QueryTypes.UPDATE,
        }
    );
}

export async function markAllOldZbdProcessed(): Promise<void> {
    await sequelize.query('UPDATE log_zbd SET dCheck = 1 WHERE dCheck = 0', {
        type: QueryTypes.UPDATE,
    });
}