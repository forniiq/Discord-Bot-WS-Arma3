import { getAllUnits } from '@/database/queries';
import { UNITS, ROLES_CONFIG } from '@/config/rolesConfig';

const isTestServer = process.env.IS_TEST_SERVER === "true" || process.env.NODE_ENV === "development";

export async function refreshUnitsCache(): Promise<void> {
    try {
        const unitsList = await getAllUnits();

        // 1. Очищаем старые отряды (сохраняя базовый дефолт "0")
        for (const key of Object.keys(UNITS)) {
            if (key !== "0") delete UNITS[key];
        }
        for (const key of Object.keys(ROLES_CONFIG.units)) {
            delete ROLES_CONFIG.units[key];
        }

        // 2. Заполняем актуальными данными из БД (согласно интерфейсу UnitData: uUID, uName, uTag, dRoleID)
        for (const unit of unitsList) {
            const uidStr = String(unit.uUID);
            const tagStr = unit.uTag || unit.uName;

            UNITS[uidStr] = unit.uName;

            ROLES_CONFIG.units[uidStr] = {
                roleId: isTestServer ? null : (unit.dRoleID || null),
                tag: tagStr
            };
        }

        console.log(`[Units] Успешно подгружено отрядов из БД: ${unitsList.length} (Тестовый режим: ${isTestServer})`);
    } catch (error) {
        console.error('[Units] Ошибка при обновлении кэша отрядов из БД:', error);
    }
}