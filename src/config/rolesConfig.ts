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
        "1532983657697120339", // 1 - Рядовой
        "1532983691197022238", // 2 - Ефрейтор
        "1532983726118535199", // 3 - Мл. Сержант
        "1532983758909870312", // 4 - Сержант
        "1532983794699731016", // 5 - Ст. Сержант
        "1532983825112764526", // 6 - Старшина
        "1532984519769198694", // 7 - Прапорщик
        "1532983890111758516", // 8 - Ст. Прапорщик
        "1532983975155335290", // 9 - Мл. Лейтенант
        "1532984023029121195", // 10 - Лейтенант
        "1532984073352511508", // 11 - Ст. Лейтенант
        "1532984112627847188", // 12 - Капитан
        "1532984134543343676", // 13 - Майор
        "1532984174003093555", // 14 - Подполковник
        "1532984882781749310", // 15 - Полковник
        "1532984214402891846", // 16 - Ген. Майор
        "1532984262704365758", // 17 - Ген. Лейтенант
        "1532984306031398943", // 18 - Ген. Полковник
        "1532984355670986842", // 19 - Ген. Армии
        "1532984390949277837", // 20 - Маршал
    ] as (string | null)[],

    rankCategories: {
        private: { categoryRoleId: "1532982775211229265", rankIndexes: [1, 2] },
        sergeant: { categoryRoleId: "1532982825953923273", rankIndexes: [3, 4, 5, 6] },
        warrant: { categoryRoleId: "1532982873144164402", rankIndexes: [7, 8] },
        juniorOfficer: { categoryRoleId: "1532982911526113362", rankIndexes: [9, 10, 11, 12] },
        seniorOfficer: { categoryRoleId: "1532983008397758528", rankIndexes: [13, 14, 15] },
        highOfficer: { categoryRoleId: "1532983075745829024", rankIndexes: [16, 17, 18, 19, 20] }
    },

    vvs: [
        "1532995820859949176", "1532995882444656750", "1532995926950543520", "1532995980016881664"
    ] as (string | null)[],

    btv: [
        "1532996226469986435", "1532996286251536524", "1532996348335362128", "1532996410918830161"
    ] as (string | null)[],

    categoryPermissionsRoleId: "1532982519560015883" as string | null,

    rp: [
        "1532996657296314428", "1532996683347005513", null, null, "1532996733750087700", "1532996755220594698"
    ] as (string | null)[],

    categorySidesRoleId: "1532982660148760696" as string | null,

    kmb: [
        "1532996972250665100", "1532997017545080832", "1532997078085537962", "1532998245557469304",
        "1532998393306153102", "1532998443512107108", "1532998499963244574", "1532998550877765683"
    ] as (string | null)[],

    categoryInstructorsRoleId: "1532982700661801172" as string | null,

    courses: [
        "1532998824832925758", "1532998887646957708", "1532998925232111707",
        "1532998958539079790", "1533003447111127110", "1532999029498183830"
    ] as (string | null)[],

    categoryCoursesRoleId: "1532982746941620364" as string | null
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