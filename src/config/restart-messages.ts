export const RESTART_MESSAGES = [
    {
        title: '🔄 РЕСТАРТ СЕРВЕРА',
        description:
            'Сервер перезапускается.\n\n' +
            '🛠️ Администратор **{operator}** запустил процедуру рестарта.\n' +
            '⏳ Пожалуйста, подождите несколько минут перед повторным подключением.'
    },
    {
        title: '⚠️ Перезагрузка СЕРВЕРА',
        description:
            'На сервере выполняется плановый перезапуск.\n\n' +
            '👤 Рестарт запустил **{operator}**.\n' +
            '🔄 Сервер скоро снова будет доступен.'
    },
    {
        title: '🛡️ ПЕРЕЗАПУСК СЕРВЕРА',
        description:
            'Выполняется перезапуск сервера.\n\n' +
            '🔧 Инициатор: **{operator}**\n' +
            '⏱️ Ожидайте завершения перезапуска.'
    },
    {
        title: '📢 СЕРВЕР ПЕРЕЗАПУСКАЕТСЯ',
        description:
            'Сервер временно недоступен из-за процедуры перезапуска.\n\n' +
            '👤 Рестарт инициировал **{operator}**.\n' +
            '🔄 Подключиться снова можно будет через пару минут.'
    },
    {
        title: '🚨 РЕСТАРТ СЕРВЕРА',
        description:
            'Администрация инициировала перезапуск сервера.\n\n' +
            '👤 Запустил: **{operator}**\n' +
            '⏳ Сервер будет доступен после завершения процедуры.'
    }
];

export function getRandomRestartMessage(
    operator: string
) {
    const message =
        RESTART_MESSAGES[
            Math.floor(Math.random() * RESTART_MESSAGES.length)
        ]!;

    return {
        title: message.title,
        description: message.description
            .replaceAll('{operator}', operator)
    };
}