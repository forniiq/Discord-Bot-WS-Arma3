import { ROLES_CONFIG } from "./roles-сonfig";

export interface ExamItem {
    id: string;
    label: string;
    cost: number;
    taxPercent?: number; // Налог в банк
    requiredRoleId?: string | null; // Специфическая роль инструктора для конкретного экзамена
}

export interface ExamCategory {
    id: string;
    label: string;
    items: ExamItem[];
    defaultTaxPercent: number; // Налог по умолчанию для всей категории
}

export const EXAM_DATA: Record<string, ExamCategory> = {
    vvs: {
        id: 'vvs',
        label: '✈️ ВВС',
        defaultTaxPercent: 20,
        items: [
            { id: 'vvs_1', label: 'ВВС 1', cost: 2000 },
            { id: 'vvs_2', label: 'ВВС 2', cost: 3000 },
            { id: 'vvs_3', label: 'ВВС 3', cost: 5000 },
            { id: 'vvs_4', label: 'ВВС 4', cost: 7000 },
        ],
    },
    btv: {
        id: 'btv',
        label: '🛡️ БТВ',
        defaultTaxPercent: 20,
        items: [
            // Мехвод БТВ доступен инструкторам мехводов (индекс 3 в kmb) или отдельной роли
            { id: 'bmp_driver', label: 'Водитель БМП ', cost: 1000, requiredRoleId: ROLES_CONFIG.kmb[8] }, 
            { id: 'btv_1', label: 'БТВ 1', cost: 2000 },
            { id: 'btv_2', label: 'БТВ 2', cost: 3000 },
            { id: 'btv_3', label: 'БТВ 3', cost: 5000 },
        ],
    },
    courses: {
        id: 'courses',
        label: '🎓 Курсы',
        defaultTaxPercent: 20,
        items: [
            { id: 'course_medic', label: 'Медик', cost: 2500, requiredRoleId: ROLES_CONFIG.kmb[7] },
            { id: 'course_officer', label: 'Офицер', cost: 10000, requiredRoleId: ROLES_CONFIG.kmb[4] },
            { id: 'course_sniper', label: 'Снайпер', cost: 2000, requiredRoleId: ROLES_CONFIG.kmb[5] },
            { id: 'course_engineer', label: 'Инженер', cost: 3000, requiredRoleId: ROLES_CONFIG.kmb[6] },
            { id: 'course_cadet', label: 'Кадет', cost: 3000, requiredRoleId: ROLES_CONFIG.kmb[13] },
            { id: 'course_sso', label: 'ССО', cost: 3000, taxPercent: 30, requiredRoleId: ROLES_CONFIG.kmb[10] },
            { id: 'course_vp', label: 'ВП', cost: 3000, taxPercent: 30, requiredRoleId: ROLES_CONFIG.kmb[9] },
        ],
    },
    factions: {
        id: 'factions',
        label: '🌍 Стороны',
        defaultTaxPercent: 20,
        items: [
            { id: 'faction_zeus', label: 'Зевс', cost: 20000, requiredRoleId: ROLES_CONFIG.kmb[11] },
            { id: 'faction_nato', label: 'НАТО', cost: 15000, requiredRoleId: ROLES_CONFIG.kmb[12] },
            { id: 'faction_rebel', label: 'Повстанец', cost: 15000 },
        ],
    },
};

// Определение роли инструктора для выбранного экзамена.
export function getRequiredInstructorRoleId(categoryId: string, itemId?: string): string | null {
    // 1. Проверяем, есть ли у самого предмета специфика по роли
    const category = EXAM_DATA[categoryId];
    if (category && itemId) {
        const item = category.items.find(i => i.id === itemId);
        if (item?.requiredRoleId) return item.requiredRoleId;
    }

    // 2. Иначе берем дефолтную роль по категории
    const roles = ROLES_CONFIG.kmb;
    switch (categoryId) {
        case 'vvs':
            return roles[0] ?? null; // Инструктор Лётчиков (ВВС)
        case 'btv':
            return roles[1] ?? null; // Инструктор Танкистов (БТВ)
        case 'factions':
            return roles[2] ?? null; // Инструктор РП сторон
        case 'courses':
            return ROLES_CONFIG.categoryInstructorsRoleId ?? null; 
        default:
            return null;
    }
}