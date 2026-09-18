import {
    createItem,
    deleteItem,
    findItemById,
    findItemsBySteamId,
    updateItem,
    deleteExpiredItems,
} from '@/database/queries/items.queries';

import { findPlayer } from '@/database/queries/players.queries';

export type ItemSide =
    | 'call isIndependent'
    | 'call isBlufor'
    | 'call isOpfor'
    | 'true';

export const ITEM_SIDES = [
    'call isIndependent',
    'call isBlufor',
    'call isOpfor',
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
        case 'call isIndependent':
            return '🟢 Зелёные';

        case 'call isBlufor':
            return '🔵 Синие';

        case 'call isOpfor':
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

function isValidDays(days: number): boolean {
    return (
        Number.isInteger(days) &&
        days > 0 &&
        days <= 3650
    );
}

export async function addPlayerItem(data: {
    steamid: string;
    className: string;
    code: string;
    days: number;
}) {
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
            message: 'Некорректная сторона.',
        };
    }

    if (!isValidDays(data.days)) {
        return {
            success: false,
            message:
                'Срок должен быть целым числом от 1 до 3650 дней.',
        };
    }

    const player = await findPlayer({
        steamId: data.steamid,
    });

    if (!player) {
        return {
            success: false,
            message:
                'Игрок не найден в базе.',
        };
    }

    const item = await createItem({
        steamid: data.steamid,
        className: data.className.trim(),
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

export async function editPlayerItem(
    itemId: number,
    data: {
        className: string;
        code: string;
        days: number;
    }
) {
    if (!Number.isInteger(itemId)) {
        return {
            success: false,
            message: 'Некорректный ID item.',
        };
    }

    if (!data.className.trim()) {
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
                'Некорректная сторона.',
        };
    }

    if (!isValidDays(data.days)) {
        return {
            success: false,
            message:
                'Срок должен быть целым числом от 1 до 3650 дней.',
        };
    }

    const oldItem =
        await findItemById(itemId);

    if (!oldItem) {
        return {
            success: false,
            message:
                'Item не найден.',
        };
    }

    const item = await updateItem(
        itemId,
        {
            className:
                data.className.trim(),
            code: data.code,
            days: data.days,
        }
    );

    if (!item) {
        return {
            success: false,
            message:
                'Не удалось изменить item.',
        };
    }

    return {
        success: true,
        item,
        oldItem,
    };
}

export async function removePlayerItem(
    itemId: number
) {
    const item =
        await findItemById(itemId);

    if (!item) {
        return {
            success: false,
            message:
                'Item уже был удалён.',
        };
    }

    const deleted =
        await deleteItem(itemId);

    if (!deleted) {
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

export async function getPlayerItems(
    steamid: string
) {
    return findItemsBySteamId(steamid);
}

export async function getPlayerItem(
    itemId: number
) {
    return findItemById(itemId);
}

export async function cleanupExpiredItems() {
    return deleteExpiredItems();
}