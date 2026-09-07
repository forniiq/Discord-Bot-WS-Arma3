export const RESTART_MESSAGES = [
    {
        title: '🔄 РЕСТАРТ {server}',
        description:
            'Сервер **{server}** перезапускается.\n\n' +
            '🛠️ Администратор **{operator}** запустил процедуру рестарта.\n' +
            '⏳ Пожалуйста, подождите несколько минут перед повторным подключением.'
    },
    {
        title: '⚠️ Перезагрузка {server}',
        description:
            'На сервере **{server}** выполняется плановый перезапуск.\n\n' +
            '👤 Рестарт запустил **{operator}**.\n' +
            '🔄 Сервер скоро снова будет доступен.'
    },
    {
        title: '🛡️ ПЕРЕЗАПУСК {server}',
        description:
            'Выполняется перезапуск сервера **{server}**.\n\n' +
            '🔧 Инициатор: **{operator}**\n' +
            '⏱️ Ожидайте завершения перезапуска.'
    },
    {
        title: '📢 СЕРВЕР {server} ПЕРЕЗАПУСКАЕТСЯ',
        description:
            'Сервер временно недоступен из-за процедуры перезапуска.\n\n' +
            '👤 Рестарт инициировал **{operator}**.\n' +
            '🔄 Подключиться снова можно будет через пару минут.'
    },
    {
        title: '🚨 РЕСТАРТ СЕРВЕРА {server}',
        description:
            'Администрация инициировала перезапуск сервера **{server}**.\n\n' +
            '👤 Запустил: **{operator}**\n' +
            '⏳ Сервер будет доступен после завершения процедуры.'
    }
];

export function getRandomRestartMessage(
    server: string,
    operator: string
) {
    const message =
        RESTART_MESSAGES[
            Math.floor(Math.random() * RESTART_MESSAGES.length)
        ]!;

    return {
        title: message.title.replaceAll('{server}', server),
        description: message.description
            .replaceAll('{server}', server)
            .replaceAll('{operator}', operator)
    };
}