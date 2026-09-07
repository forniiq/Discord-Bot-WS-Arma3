import { isOperator } from '@/database/queries/operators.queries';

export async function requireOperator(discordId: string): Promise<boolean> {
    try {
        return await isOperator(discordId);
    } catch (error) {
        console.error('[OperatorCheck] Ошибка проверки оператора:', error);
        return false;
    }
}