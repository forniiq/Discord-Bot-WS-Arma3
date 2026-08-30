import { QueryTypes } from 'sequelize';
import { sequelize } from '../connect';

export interface InfoData {
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

// Получить актуальную информацию о текущем состоянии ЗБД
export async function getCurrentInfo(): Promise<InfoData | null> {
    try {
        const rows = await sequelize.query<InfoData>(
            'SELECT City, Time, FPS FROM info LIMIT 1',
            { type: QueryTypes.SELECT }
        );
        
        return rows[0] || null;
    } catch (error) {
        console.error('Ошибка при получении данных из таблицы info:', error);
        return null;
    }
}