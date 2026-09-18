import {
    createItem,
    deleteExpiredItems,
    deleteItem,
    getItemById,
    getItemsBySteamId,
    updateItem,
    type ItemInfo,
} from '@/database/queries/items.queries';

import { findPlayer } from '@/database/queries/players.queries';

export type ItemSide = 'independent' | 'blufor' | 'Opfor' | 'true';

export const ITEM_SIDES = [
    'independent',
    'blufor',
    'Opfor',
    'true',
] as const;

export function isValidItemSide(
    side: string
): side is ItemSide {
    return ITEM_SIDES.includes(side as ItemSide);
}

export function getItemSideName(code: string): string {
    switch (code) {
        case 'independent':
            return '🟢 Independent';

        case 'blufor':
            return '🔵 Blufor';

        case 'Opfor':
            return '🔴 Opfor';

        case 'true':
            return '⚪ Все стороны';

        default:
            return `❓ ${code}`;
    }
}

export function isValidSteamId(steamid: string): boolean {
    return /^\d{17}$/.test(steamid);
}

export function parseExpirationDate(
    input: string
): Date | null {
    const normalized = input.trim().replace('T', ' ');

    const match = normalized.match(
        /^(\d{4})-(\d{2})-(\d{2})[ ](\d{2}):(\d{2}):(\d{2})$/
    );

    if (!match) {
        return null;
    }

    const [
        ,
        year,
        month,
        day,
        hour,
        minute,
        second,
    ] = match;

    const date = new Date(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second)
    );

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    if (
        date.getFullYear() !== Number(year) ||
        date.getMonth() !== Number(month) - 1 ||
        date.getDate() !== Number(day) ||
        date.getHours() !== Number(hour) ||
        date.getMinutes() !== Number(minute) ||
        date.getSeconds() !== Number(second)
    ) {
        return null;
    }

    return date;
}

export async function getPlayerItems(
    steamid: string
): Promise<ItemInfo[]> {
    return getItemsBySteamId(steamid);
}

export async function addPlayerItem(data: {
    steamid: string;
    className: string;
    code: string;
    srok: Date;
}): Promise<{
    success: boolean;
    message?: string;
    item?: ItemInfo;
    playerName?: string;
}> {
    if (!isValidSteamId(data.steamid)) {
        return {
            success: false,
            message: 'Некорректный SteamID64.',
        };
    }

    if (!data.className.trim()) {
        return {
            success: false,
            message: 'ClassName не может быть пустым.',
        };
    }

    if (!isValidItemSide(data.code)) {
        return {
            success: false,
            message: 'Указана некорректная сторона.',
        };
    }

    if (data.srok.getTime() <= Date.now()) {
        return {
            success: false,
            message: 'Срок действия должен быть в будущем.',
        };
    }

    const player = await findPlayer({
        steamId: data.steamid,
    });

    if (!player) {
        return {
            success: false,
            message: `Игрок с SteamID \`${data.steamid}\` не найден в базе.`,
        };
    }

    const item = await createItem(data);

    if (!item) {
        return {
            success: false,
            message: 'Не удалось создать запись в базе данных.',
        };
    }

    return {
        success: true,
        item,
        playerName: player.pName,
    };
}

export async function getPlayerItem(
    id: number
): Promise<ItemInfo | null> {
    return getItemById(id);
}

export async function editPlayerItem(
    id: number,
    data: {
        className: string;
        code: string;
        srok: Date;
    }
): Promise<{
    success: boolean;
    message?: string;
    oldItem?: ItemInfo;
    item?: ItemInfo;
}> {
    const oldItem = await getItemById(id);

    if (!oldItem) {
        return {
            success: false,
            message: 'Item не найден.',
        };
    }

    if (!data.className.trim()) {
        return {
            success: false,
            message: 'ClassName не может быть пустым.',
        };
    }

    if (!isValidItemSide(data.code)) {
        return {
            success: false,
            message: 'Указана некорректная сторона.',
        };
    }

    if (data.srok.getTime() <= Date.now()) {
        return {
            success: false,
            message: 'Срок действия должен быть в будущем.',
        };
    }

    const success = await updateItem(id, data);

    if (!success) {
        return {
            success: false,
            message: 'Не удалось изменить item.',
        };
    }

    const item = await getItemById(id);

    return {
        success: true,
        oldItem,
        item: item ?? undefined,
    };
}

export async function removePlayerItem(
    id: number
): Promise<{
    success: boolean;
    message?: string;
    item?: ItemInfo;
}> {
    const item = await getItemById(id);

    if (!item) {
        return {
            success: false,
            message: 'Item не найден.',
        };
    }

    const success = await deleteItem(id);

    if (!success) {
        return {
            success: false,
            message: 'Не удалось удалить item.',
        };
    }

    return {
        success: true,
        item,
    };
}

/**
 * Удаление просроченных предметов.
 */
export async function cleanupExpiredItems(): Promise<number> {
    return deleteExpiredItems();
}