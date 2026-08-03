import { sequelize } from '../connect';

export interface PlayerInfo {
    ID: number;
    pUID: string;
    pName: string;
    pLvl: string;
    pExp: number;
    pCYP: string;
    pBTV: string;
    pRP: string;
    pKMB: string;
    pSkill: string;
    pBoss: string;
    pKarma: number;
    pUnits: string;
    DiscID: string | null;
}

export interface OnlinePlayer {
    pName: string;
    pLvl: string;
    pLvlSort: number;
    Slot: string;
}

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

export async function updatePlayerField(pUID: string, field: string, value: any, transaction?: any): Promise<boolean> {
    try {
        await sequelize.query(
            `UPDATE players SET ${field} = :value WHERE pUID = :pUID`,
            { replacements: { value, pUID }, transaction }
        );
        return true;
    } catch (e) {
        console.error("Ошибка при обновлении игрока:", e);
        return false;
    }
}

export async function findAllSyncablePlayers(): Promise<PlayerInfo[]> {
    const [rows] = await sequelize.query(`
        SELECT * FROM players 
        WHERE DiscID IS NOT NULL AND DiscID != '0' AND DiscID != ''
    `);
    return rows as PlayerInfo[];
}

export async function getOnlineCount(): Promise<number> {
    const [rows] = await sequelize.query(`SELECT COUNT(*) as count FROM players_online`);
    return (rows as any)[0].count as number;
}

export async function getOnlinePlayers(): Promise<OnlinePlayer[]> {
    const [rows] = await sequelize.query(`
        SELECT p.pName, s.pLvl, s.pLvlSort, s.Slot
        FROM stats o
        INNER JOIN players p ON o.pUID = p.pUID
        INNER JOIN stats s ON p.pName = s.pName
        ORDER BY s.pLvlSort DESC, p.pName ASC
    `);
    return rows as OnlinePlayer[];
}