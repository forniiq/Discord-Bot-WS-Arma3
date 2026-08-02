export const RANKS = [
    "Новобранец", "Рядовой", "Ефрейтор", "Мл.Сержант", "Сержант", "Ст.Сержант", 
    "Старшина", "Прапорщик", "Ст.Прапорщик", "Мл.Лейтенант", "Лейтенант", 
    "Ст.Лейтенант", "Капитан", "Майор", "Подполковник", "Полковник", 
    "Ген.Майор", "Ген.Лейтенант", "Ген.Полковник", "Ген.Армии", "Маршал"
];

// Динамический словарь названий отрядов (заполняется из БД при старте)
export const UNITS: Record<string, string> = {
    "0": "Без отряда",
};

export const TOGGLE_CATEGORIES = {
    vvs: {
        dbColumn: "pCYP",
        title: "Допуски ВВС",
        options: ["Транспортные вертолёты", "Боевые вертолёты", "Транспортные самолёты", "Боевые самолёты"]
    },
    btv: {
        dbColumn: "pBTV",
        title: "Допуски БТВ",
        options: ["Механик-водитель БМП", "Гусеничная средняя техника", "Гусеничная тяжелая техника", "Артиллерия"]
    },
    rp: {
        dbColumn: "pRP",
        title: "🧭 Допуски РП",
        options: ["Зевс", "Повстанец", "Стрингер", "Красный Крест", "НАТО", "Легионер"]
    },
    kmb: {
        dbColumn: "pKMB",
        title: "Инструктора (КМБ)",
        options: ["Лётчиков", "Танкистов", "РП сторон", "Новобранцев", "Офицеров", "Снайперов", "Инженеров", "Медиков"]
    },
    courses: {
        dbColumn: "pSkill",
        title: "Курсы и Навыки",
        options: ["Офицер", "Инженер", "Снайпер", "Медик", "Кадет", "ССО"]
    },
    boss: {
        dbColumn: "pBoss",
        title: "Допуски Руководства",
        options: ["Админ", "Тех.Поддержка", "Заместитель", "Разработчик"]
    }
};

export interface CategoryRoleRule {
    categoryRoleId: string | null;
    childrenRoleIds: (string | null)[];
}

// Конфигурация ролей для Основного сервера
const PROD_ROLES_CONFIG = {
    units: {} as Record<string, { roleId: string | null; tag: string }>,
    categoryUnitsRoleId: "1532982390262075633" as string | null,

    ranks: [
        null,                  // 0 - Новобранец
        "1262342579337297958", // 1 - Рядовой
        "1262342579337297959", // 2 - Ефрейтор
        "1262342579350147103", // 3 - Мл. Сержант
        "1262342579350147104", // 4 - Сержант
        "1262342579350147105", // 5 - Ст. Сержант
        "1262342579350147106", // 6 - Старшина
        "1262342579350147108", // 7 - Прапорщик
        "1262342579350147109", // 8 - Ст. Прапорщик
        "1262342579350147111", // 9 - Мл. Лейтенант
        "1262342579350147112", // 10 - Лейтенант
        "1262342579371114587", // 11 - Ст. Лейтенант
        "1262342579371114588", // 12 - Капитан
        "1262342579371114590", // 13 - Майор
        "1262342579371114591", // 14 - Подполковник
        "1262342579371114592", // 15 - Полковник
        "1262342579371114594", // 16 - Ген. Майор
        "1262342579371114595", // 17 - Ген. Лейтенант
        "1262342579371114596", // 18 - Ген. Полковник
        "1262342579387760650", // 19 - Ген. Армии
        "1262342579387760651", // 20 - Маршал
    ] as (string | null)[],

    rankCategories: {
        private: { categoryRoleId: "1262342579337297960", rankIndexes: [1, 2] },
        sergeant: { categoryRoleId: "1262342579350147107", rankIndexes: [3, 4, 5, 6] },
        warrant: { categoryRoleId: "1262342579350147110", rankIndexes: [7, 8] },
        juniorOfficer: { categoryRoleId: "1262342579371114589", rankIndexes: [9, 10, 11, 12] },
        seniorOfficer: { categoryRoleId: "1262342579371114593", rankIndexes: [13, 14, 15] },
        highOfficer: { categoryRoleId: "1262342579387760652", rankIndexes: [16, 17, 18, 19, 20] }
    },

    vvs: [
        "1262342579463393404", "1262342579463393403", "1262342579463393402", "1262342579463393401"
    ] as (string | null)[],

    btv: [
        "1262342579463393400", "1262342579438092349", "1262342579438092348", "1262342579438092347"
    ] as (string | null)[],

    categoryPermissionsRoleId: "1262342579463393405" as string | null,

    rp: [
        "1262342579463393406", "1463581753707991101", null, null, "1262342579463393407", "1405203025890508860"
    ] as (string | null)[],

    categorySidesRoleId: "1262342579463393408" as string | null,

    kmb: [
        "1262342579480166452", "1262342579480166451", null, "1262342579480166458",
        "1262342579480166456", "1262342579480166453", "1262342579480166455", "1262342579480166454"
    ] as (string | null)[],

    categoryInstructorsRoleId: "1262342579492618274" as string | null,

    courses: [
        "1262342579438092345", "1262342579438092343", "1299333595420299299",
        "1262342579438092344", "1262342579438092341", null
    ] as (string | null)[],

    categoryCoursesRoleId: "1262342579438092346" as string | null
};

// Проверяем, является ли текущий запуск тестовым сервером
const isTestServer = process.env.IS_TEST_SERVER === "true" || process.env.NODE_ENV === "development";

// Вспомогательная функция для обнуления ролей
function nullifyRoles<T>(config: T): T {
    if (!isTestServer) return config;

    const nullified = JSON.parse(JSON.stringify(config));
    
    nullified.categoryUnitsRoleId = null;
    nullified.categoryPermissionsRoleId = null;
    nullified.categorySidesRoleId = null;
    nullified.categoryInstructorsRoleId = null;
    nullified.categoryCoursesRoleId = null;

    nullified.ranks = nullified.ranks.map(() => null);
    nullified.vvs = nullified.vvs.map(() => null);
    nullified.btv = nullified.btv.map(() => null);
    nullified.rp = nullified.rp.map(() => null);
    nullified.kmb = nullified.kmb.map(() => null);
    nullified.courses = nullified.courses.map(() => null);

    for (const key in nullified.rankCategories) {
        nullified.rankCategories[key].categoryRoleId = null;
    }

    return nullified;
}

export const ROLES_CONFIG = nullifyRoles(PROD_ROLES_CONFIG);