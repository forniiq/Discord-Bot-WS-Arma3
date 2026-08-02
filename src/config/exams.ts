import { ROLES_CONFIG } from "./rolesConfig";

export interface ExamItem {
    id: string;
    label: string;
    cost: number;
}

export interface ExamCategory {
    id: string;
    label: string;
    items: ExamItem[];
}

export const EXAM_DATA: Record<string, ExamCategory> = {
    vvs: {
        id: 'vvs',
        label: '✈️ ВВС',
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
        items: [
            { id: 'btv_driver', label: 'БТВ Мехвод', cost: 1000 },
            { id: 'btv_1', label: 'БТВ 1', cost: 2000 },
            { id: 'btv_2', label: 'БТВ 2', cost: 3000 },
            { id: 'btv_3', label: 'БТВ 3', cost: 5000 },
        ],
    },
    courses: {
        id: 'courses',
        label: '🎓 Курсы',
        items: [
            { id: 'course_medic', label: 'Медик', cost: 2500 },
            { id: 'course_officer', label: 'Офицер', cost: 10000 },
            { id: 'course_sniper', label: 'Снайпер', cost: 2000 },
            { id: 'course_engineer', label: 'Инженер', cost: 3000 },
        ],
    },
    factions: {
        id: 'factions',
        label: '🌍 Стороны',
        items: [
            { id: 'faction_zeus', label: 'Зевс', cost: 20000 },
            { id: 'faction_nato', label: 'НАТО', cost: 15000 },
            { id: 'faction_rebel', label: 'Повстанец', cost: 20000 },
        ],
    },
};

export function getRequiredInstructorRoleId(categoryId: string): string | null {
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