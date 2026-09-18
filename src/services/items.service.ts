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

export type ItemSide =
    | 'independent'
    | 'blufor'
    | 'Opfor'
    | 'true';

export const ITEM_SIDES = [
    'independent',
    'blufor',
    'Opfor',
    'true',
] as const;

export function isValidItemSide(
    side: string
): side is ItemSide {
    return ITEM_SIDES.includes(
        side as ItemSide
    );
}

export function getItemSideName(
    code: string
): string {
    switch (code) {
        case 'independent':
            return '🟢 Зелёные';

        case 'blufor':
            return '🔵 Синие';

        case 'Opfor':
            return '🔴 Красные';

        case 'true':
            return '⚪ Все стороны';

        default:
            return `❓ ${code}`;
    }
}

export function isValidSteamId(
    steamid: string
): boolean {
    return /^\d{17}$/.test(steamid);
}

export function isValidDays(
    days: number
): boolean {
    return (
        Number.isInteger(days) &&
        days > 0 &&
        days <= 3650
    );
}

export async function getPlayerItems(
    steamid: string
): Promise<ItemInfo[]> {
    return getItemsBySteamId(steamid);
}

export async function addPlayerItem(data: {
    steamid: string;
    className: string;
    code: ItemSide;
    days: number;
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

    const className =
        data.className.trim();

    if (!className) {
        return {
            success: false,
            message:
                'ClassName не может быть пустым.',
        };
    }

    if (!isValidItemSide(data.code)) {
        return {
            success: false,
            message:
                'Указана некорректная сторона.',
        };
    }

    if (!isValidDays(data.days)) {
        return {
            success: false,
            message:
                'Количество дней должно быть от 1 до 3650.',
        };
    }

    const player =
        await findPlayer({
            steamId: data.steamid,
        });

    if (!player) {
        return {
            success: false,
            message:
                `Игрок с SteamID \`${data.steamid}\` не найден в базе.`,
        };
    }

    const item =
        await createItem({
            steamid: data.steamid,
            className,
            code: data.code,
            days: data.days,
        });

    if (!item) {
        return {
            success: false,
            message:
                'Не удалось создать запись в базе данных.',
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
        code: ItemSide;
        days: number;
    }
): Promise<{
    success: boolean;
    message?: string;
    oldItem?: ItemInfo;
    item?: ItemInfo;
}> {
    const oldItem =
        await getItemById(id);

    if (!oldItem) {
        return {
            success: false,
            message: 'Item не найден.',
        };
    }

    const className =
        data.className.trim();

    if (!className) {
        return {
            success: false,
            message:
                'ClassName не может быть пустым.',
        };
    }

    if (!isValidItemSide(data.code)) {
        return {
            success: false,
            message:
                'Указана некорректная сторона.',
        };
    }

    if (!isValidDays(data.days)) {
        return {
            success: false,
            message:
                'Количество дней должно быть от 1 до 3650.',
        };
    }

    const success =
        await updateItem(id, {
            className,
            code: data.code,
            days: data.days,
        });

    if (!success) {
        return {
            success: false,
            message:
                'Не удалось изменить item.',
        };
    }

    const item =
        await getItemById(id);

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
    const item =
        await getItemById(id);

    if (!item) {
        return {
            success: false,
            message: 'Item не найден.',
        };
    }

    const success =
        await deleteItem(id);

    if (!success) {
        return {
            success: false,
            message:
                'Не удалось удалить item.',
        };
    }

    return {
        success: true,
        item,
    };
}

export async function cleanupExpiredItems(): Promise<number> {
    return deleteExpiredItems();
}