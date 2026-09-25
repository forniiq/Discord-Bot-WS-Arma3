import { findPlayer } from '@/database/queries/players.queries';
import {
    DECREE_ISSUERS,
    DECREE_SUBJECTS,
} from '@/config/decree-categories';
import { RANKS } from '@/config/edit-сategories';
import { SERVER_CONFIG } from '@/config/server.config';

export interface DecreeSignature {
    title: string;
    name: string;
    rank: string;
}

export interface DecreeData {
    number: number;
    date: string;

    issuer: {
        value: string;
        title: string;
        name: string;
        rank: string;
    };

    subject: string;

    points: string[];

    signatures: DecreeSignature[];

    executor: {
        name: string;
        rank: string;
    };
}

function getRankByLevel(level: string): string {
    const index = Number(level);

    return RANKS[index] ?? 'Неизвестное звание';
}

function cleanPlayerName(name: string): string {
    return name
        .replace(/^\[[^\]]+\]\s*/i, '')
        .trim();
}

function formatDate(): string {
    const date = new Date();

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    return `${day}.${month}.${year}`;
}

export async function createDecreeData(params: {
    memberId: string;
    memberRoleIds: string[];

    number: number;
    issuerValue: string;
    subjectValue: string;
    points: string[];

    issuerPerson: {
        name: string;
        rank: string;
    };
}): Promise<DecreeData> {
    const {
        memberId,
        memberRoleIds,
        number,
        issuerValue,
        subjectValue,
        points,
        issuerPerson,
    } = params;

    // --------------------------------
    // 1. Находим выбранного издателя
    // --------------------------------

    const issuer = DECREE_ISSUERS.find(
        item => item.value === issuerValue
    );

    if (!issuer) {
        throw new Error('Неизвестный тип издателя приказа.');
    }

    // --------------------------------
    // 2. Проверяем роль пользователя
    // --------------------------------

    if (
        !memberRoleIds.includes(
            SERVER_CONFIG.discord.roles.chiefAdmin
        )
    ) {
        throw new Error(
            'Создавать приказы может только Главный администратор.'
        );
    }

    // --------------------------------
    // 3. Находим тему приказа
    // --------------------------------

    const subject = DECREE_SUBJECTS.find(
        item => item.value === subjectValue
    );

    if (!subject) {
        throw new Error('Неизвестная тема приказа.');
    }

    // --------------------------------
    // 4. Находим исполнителя в БД
    // --------------------------------

    const player = await findPlayer({
        discordId: memberId,
    });

    if (!player) {
        throw new Error(
            'Вы не зарегистрированы в базе игроков.'
        );
    }

    const executorName = cleanPlayerName(player.pName);
    const executorRank = getRankByLevel(player.pLvl);

    // --------------------------------
    // 5. Подписи
    // --------------------------------

    const signatures: DecreeSignature[] = [
        {
            title: issuer.label,
            name: issuerPerson.name,
            rank: issuerPerson.rank,
        },
    ];

    // --------------------------------
    // 6. Формируем итоговые данные
    // --------------------------------

    return {
        number,
        date: formatDate(),

        issuer: {
            value: issuer.value,
            title: issuer.label,
            name: issuerPerson.name,
            rank: issuerPerson.rank,
        },

        subject: subject.label,

        points,

        signatures,

        executor: {
            name: executorName,
            rank: executorRank,
        },
    };
}