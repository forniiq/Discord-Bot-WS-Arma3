import path from 'node:path';

import type { GuildMember } from 'discord.js';

import {
    AWARD_MEDALS,
    DECREE_ISSUERS,
} from '@/config/decree-categories';

import {
    findPlayer,
} from '@/database/queries/players.queries';

import {
    RANKS,
} from '@/config/edit-сategories';

export interface AwardDecreeData {
    number: number;
    date: string;

    player: {
        squad: string;
        callsign: string;
        rank: string;
        discordId: string;
    };

    medal: {
        value: string;
        name: string;
        filePath: string;
    };

    issuer: {
        value: string;
        title: string;
        name: string;
        rank: string;
    };
}

function getRankByLevel(level: string): string {
    const index = Number(level);

    return RANKS[index] ?? 'Неизвестное звание';
}

function parseDisplayName(displayName: string): {
    squad: string;
    callsign: string;
} {
    const match = displayName.match(/^\[([^\]]+)\]\s*(.+)$/);

    if (!match) {
        return {
            squad: '',
            callsign: displayName.trim(),
        };
    }

    return {
        squad: match[1]!.trim(),
        callsign: match[2]!.trim(),
    };
}

function formatDate(): string {
    const date = new Date();

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    return `${day}.${month}.${year}`;
}

export async function createAwardDecreeData(params: {
    number: number;

    playerMember: GuildMember;

    medalValue: string;

    issuerValue: string;

    issuerMember: GuildMember;
}): Promise<AwardDecreeData> {

    const {
        number,
        playerMember,
        medalValue,
        issuerValue,
        issuerMember,
    } = params;

    /*
     * =========================
     * Награждаемый
     * =========================
     */

    const player = await findPlayer({
        discordId: playerMember.id,
    });

    if (!player) {
        throw new Error(
            'Награждаемый пользователь не зарегистрирован в базе игроков.'
        );
    }

    // Используем именно Discord Display Name.
    const {
        squad,
        callsign,
    } = parseDisplayName(playerMember.displayName);

    // Игровое звание получаем из БД.
    const playerRank = getRankByLevel(player.pLvl);

    /*
     * =========================
     * Медаль
     * =========================
     */

    const medal = AWARD_MEDALS.find(
        medal => medal.value === medalValue
    );

    if (!medal) {
        throw new Error(
            'Неизвестная медаль.'
        );
    }

    const filePath = path.join(
        process.cwd(),
        'assets',
        'medals',
        medal.fileName
    );

    /*
     * =========================
     * Издатель приказа
     * =========================
     */

    const issuer = DECREE_ISSUERS.find(
        issuer => issuer.value === issuerValue
    );

    if (!issuer) {
        throw new Error(
            'Неизвестный издатель приказа.'
        );
    }

    // Имя издателя берём именно из Discord Display Name.
    const issuerName = issuerMember.displayName;

    // Звание издателя получаем из БД.
    const issuerPlayer = await findPlayer({
        discordId: issuerMember.id,
    });

    if (!issuerPlayer) {
        throw new Error(
            'Издатель приказа не зарегистрирован в базе игроков.'
        );
    }

    const issuerRank = getRankByLevel(
        issuerPlayer.pLvl
    );

    /*
     * =========================
     * Результат
     * =========================
     */

    return {
        number,

        date: formatDate(),

        player: {
            squad,
            callsign,
            rank: playerRank,
            discordId: playerMember.id,
        },

        medal: {
            value: medal.value,
            name: medal.label,
            filePath,
        },

        issuer: {
            value: issuer.value,
            title: issuer.label,
            name: issuerName,
            rank: issuerRank,
        },
    };
}