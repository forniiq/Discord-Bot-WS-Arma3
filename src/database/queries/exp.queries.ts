import { sequelize } from '../connect';
import { QueryTypes, Transaction } from 'sequelize';
import { addBankExp } from './bank.queries';
import { deductExpWithRankDemotion, addExpWithRankPromotion } from '../../utils/exp.utils';

export interface PlayerExpData {
    DiscID: string;
    pLvl: number;
    pExp: number;
}

export interface ExamTransactionResult {
    success: boolean;
    error?: string;
    studentResult?: {
        oldLvl: number;
        oldExp: number;
        newLvl: number;
        newExp: number;
    };
    instructorResult?: {
        oldLvl: number;
        oldExp: number;
        newLvl: number;
        newExp: number;
        rankChanged: boolean;
    };
}

// Получить уровень и опыт игрока по Discord ID
export async function getPlayerExpData(discId: string, transaction?: Transaction): Promise<PlayerExpData | null> {
    const rows = await sequelize.query<PlayerExpData>(
        'SELECT DiscID, CAST(pLvl AS UNSIGNED) as pLvl, CAST(pExp AS UNSIGNED) as pExp FROM players WHERE DiscID = :discId LIMIT 1',
        {
            replacements: { discId },
            type: QueryTypes.SELECT,
            transaction
        }
    );
    return rows[0] ?? null;
}

// Обновить уровень и опыт игрока по Discord ID
export async function updatePlayerExpAndRankByDiscId(
    discId: string, 
    pLvl: number, 
    pExp: number, 
    transaction?: Transaction
): Promise<void> {
    await sequelize.query(
        'UPDATE players SET pLvl = :pLvl, pExp = :pExp WHERE DiscID = :discId',
        {
            replacements: { discId, pLvl, pExp },
            type: QueryTypes.UPDATE,
            transaction
        }
    );
}

// Атомарная проведение оплаты экзамена в БД
export async function processExamTransaction(
    studentDiscId: string,
    instructorDiscId: string,
    examCost: number,
    instructorReward: number,
    taxAmount: number
): Promise<ExamTransactionResult> {
    const t = await sequelize.transaction();

    try {
        const student = await getPlayerExpData(studentDiscId, t);
        if (!student) {
            await t.rollback();
            return { success: false, error: 'STUDENT_NOT_FOUND' };
        }

        const instructor = await getPlayerExpData(instructorDiscId, t);
        if (!instructor) {
            await t.rollback();
            return { success: false, error: 'INSTRUCTOR_NOT_FOUND' };
        }

        // 1. Расчет нового состояния ученика (Списание / Понижение)
        const studentCalc = deductExpWithRankDemotion(student.pLvl, student.pExp, examCost);
        await updatePlayerExpAndRankByDiscId(studentDiscId, studentCalc.newRankIndex, studentCalc.newExp, t);

        // 2. Расчет нового состояния инструктора (Начисление / Повышение)
        const instructorCalc = addExpWithRankPromotion(instructor.pLvl, instructor.pExp, instructorReward);
        await updatePlayerExpAndRankByDiscId(instructorDiscId, instructorCalc.newRankIndex, instructorCalc.newExp, t);

        // 3. Перечисление налога в Банк Опыта
        await addBankExp(taxAmount, t);

        await t.commit();

        return {
            success: true,
            studentResult: {
                oldLvl: student.pLvl,
                oldExp: student.pExp,
                newLvl: studentCalc.newRankIndex,
                newExp: studentCalc.newExp
            },
            instructorResult: {
                oldLvl: instructor.pLvl,
                oldExp: instructor.pExp,
                newLvl: instructorCalc.newRankIndex,
                newExp: instructorCalc.newExp,
                rankChanged: instructorCalc.rankChanged
            }
        };
    } catch (error) {
        await t.rollback();
        console.error('Ошибка транзакции оплаты экзамена:', error);
        return { success: false, error: 'DB_ERROR' };
    }
}