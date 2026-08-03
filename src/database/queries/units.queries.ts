import { QueryTypes } from 'sequelize';
import { sequelize } from '../connect';

export interface UnitData {
    uUID: string | number;
    uName: string;
    uTag: string;
    dRoleID: string | null;
}

// Получить список всех отрядов из базы данных со всеми полями
export async function getAllUnits(): Promise<UnitData[]> {
    try {
        const rows = await sequelize.query<UnitData>(
            'SELECT uUID, uName, uTag, dRoleID FROM units ORDER BY uName ASC',
            { type: QueryTypes.SELECT }
        );
        return rows;
    } catch (e) {
        console.error('Ошибка при получении списка отрядов:', e);
        return [];
    }
}

// Получить список всех тегов отрядов
export async function getApprovedUnitsList(): Promise<string[]> {
    const units = await getAllUnits();
    return units.map((u) => u.uTag || u.uName);
}

// Обновить Discord Role ID для конкретного отряда
export async function updateUnitRoleId(
    uUID: string | number,
    dRoleID: string | null
): Promise<void> {
    await sequelize.query(
        'UPDATE units SET dRoleID = :dRoleID WHERE uUID = :uUID',
        {
            replacements: { uUID, dRoleID },
            type: QueryTypes.UPDATE,
        }
    );
}