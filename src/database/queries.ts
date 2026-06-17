import { sequelize } from "./connect";

export interface OnlinePlayer {
    pName: string;
    pLvl: string;
    pLvlSort: number;
    Slot: string;
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
        FROM players_online o
        INNER JOIN players p
            ON o.pUID = p.pUID
        INNER JOIN stats s
            ON p.pName = s.pName
        ORDER BY s.pLvlSort DESC, p.pName ASC
    `);

    return rows as OnlinePlayer[];
}