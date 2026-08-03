import { QueryTypes } from 'sequelize';
import { sequelize } from '../connect';

export interface OperatorRecord {
    id?: number;
    DiscID: string;
    name?: string;
}

// Проверяет, является ли пользователь оператором бота
export async function isOperator(discordId: string): Promise<boolean> {
    const rows = await sequelize.query(
        'SELECT 1 FROM operators WHERE DiscID = :discordId LIMIT 1',
        {
            replacements: { discordId },
            type: QueryTypes.SELECT,
        }
    );
    return rows.length > 0;
}

// Получить список всех ID операторов
export async function getAllOperators(): Promise<OperatorRecord[]> {
    return await sequelize.query<OperatorRecord>(
        'SELECT * FROM operators',
        { type: QueryTypes.SELECT }
    );
}

// Добавить оператора в базу данных
export async function addOperator(discordId: string, name?: string): Promise<void> {
    await sequelize.query(
        'INSERT INTO operators (DiscID, name) VALUES (:discordId, :name) ON DUPLICATE KEY UPDATE name = :name',
        {
            replacements: { discordId, name: name ?? null },
            type: QueryTypes.INSERT,
        }
    );
}

// Удалить оператора из базы данных
export async function removeOperator(discordId: string): Promise<void> {
    await sequelize.query(
        'DELETE FROM operators WHERE DiscID = :discordId',
        {
            replacements: { discordId },
            type: QueryTypes.DELETE,
        }
    );
}