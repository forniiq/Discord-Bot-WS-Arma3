import { sequelize } from '../connect';
import { QueryTypes, Transaction } from 'sequelize';

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

export async function addBankExp(amount: number, transaction?: Transaction): Promise<void> {
    await sequelize.query(
        'UPDATE bank SET expBank = expBank + :amount LIMIT 1',
        { replacements: { amount }, type: QueryTypes.UPDATE, transaction }
    );
}