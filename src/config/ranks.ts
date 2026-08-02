export interface RankInfo {
    name: string;
    exp: number;
    shortName: string;
    fullName: string;
}

export const RANKS_DATA: RankInfo[] = [
    { name: 'Новобранец', exp: 0, shortName: 'Дух', fullName: 'Новобранец' },
    { name: 'Рядовой', exp: 0, shortName: 'Ряд.', fullName: 'Рядовой' },
    { name: 'Ефрейтор', exp: 500, shortName: 'Ефр.', fullName: 'Ефрейтор' },
    { name: 'Младший Сержант', exp: 1500, shortName: 'Мл.Серж.', fullName: 'Мл.Сержант' },
    { name: 'Сержант', exp: 11000, shortName: 'Серж.', fullName: 'Сержант' },
    { name: 'Старший Сержант', exp: 18000, shortName: 'Ст.Серж.', fullName: 'Ст.Сержант' },
    { name: 'Старшина', exp: 25000, shortName: 'Старшина', fullName: 'Старшина' },
    { name: 'Прапорщик', exp: 35000, shortName: 'Прапор.', fullName: 'Прапорщик' },
    { name: 'Старший Прапорщик', exp: 50000, shortName: 'Ст.Прапор.', fullName: 'Ст.Прапорщик' },
    { name: 'Младший Лейтенант', exp: 70900, shortName: 'Мл.Лейт.', fullName: 'Мл.Лейтенант' },
    { name: 'Лейтенант', exp: 425000, shortName: 'Лейт.', fullName: 'Лейтенант' },
    { name: 'Старший Лейтенант', exp: 475000, shortName: 'Ст.Лейт.', fullName: 'Ст.Лейтенант' },
    { name: 'Капитан', exp: 1990000, shortName: 'Капитан', fullName: 'Капитан' },
    { name: 'Майор', exp: 1990000, shortName: 'Майор', fullName: 'Майор' },
    { name: 'Подполковник', exp: 1890000, shortName: 'Подполк.', fullName: 'Подполковник' },
    { name: 'Полковник', exp: 1990000, shortName: 'Полков.', fullName: 'Полковник' },
    { name: 'Генерал-майор', exp: 19900000, shortName: 'Ген.Майор', fullName: 'Ген.Майор' },
    { name: 'Генерал-лейтенант', exp: 450500000, shortName: 'Ген.Лейт.', fullName: 'Ген.Лейтенант' },
    { name: 'Генерал-полковник', exp: 6000000, shortName: 'Ген.Полков.', fullName: 'Ген.Полковник' },
    { name: 'Генерал-армии', exp: 8000000, shortName: 'Ген.Армии', fullName: 'Ген.Армии' },
    { name: 'Маршал_ВС_WarSpectra', exp: 10000000, shortName: 'Маршал', fullName: 'Маршал' }
];