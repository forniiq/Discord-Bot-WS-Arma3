import { sequelize } from '@/database/connect';

export interface ItemInfo {
    id: number;
    steamid: string;
    className: string;
    code: string;
    insert_at: Date;
    srok: Date;
}

export async function createItem(data: {
    steamid: string;
    className: string;
    code: string;
    days: number;
}): Promise<ItemInfo | null> {
    try {
        const days = Math.trunc(data.days);

        if (
            !Number.isInteger(days) ||
            days <= 0 ||
            days > 3650
        ) {
            return null;
        }

        const [, metadata] =
            await sequelize.query(
                `
                INSERT INTO items (
                    steamid,
                    className,
                    code,
                    insert_at,
                    srok
                )
                VALUES (
                    :steamid,
                    :className,
                    :code,
                    NOW(),
                    DATE_ADD(
                        NOW(),
                        INTERVAL ${days} DAY
                    )
                )
                `,
                {
                    replacements: {
                        steamid: data.steamid,
                        className: data.className,
                        code: data.code,
                    },
                }
            );

        const insertId =
            Number(
                (metadata as any)?.insertId
            );

        if (!insertId) {
            console.error(
                'INSERT выполнен, но insertId не получен:',
                metadata
            );

            return null;
        }

        return findItemById(insertId);
    } catch (error) {
        console.error(
            'Ошибка создания item:',
            error
        );

        return null;
    }
}

export async function findItemById(
    id: number
): Promise<ItemInfo | null> {
    const [rows] =
        await sequelize.query(
            `
            SELECT *
            FROM items
            WHERE id = :id
            LIMIT 1
            `,
            {
                replacements: { id },
            }
        );

    return (
        (rows as ItemInfo[])[0] ??
        null
    );
}

export async function findItemsBySteamId(
    steamid: string
): Promise<ItemInfo[]> {
    const [rows] =
        await sequelize.query(
            `
            SELECT *
            FROM items
            WHERE steamid = :steamid
              AND srok > NOW()
            ORDER BY srok ASC
            `,
            {
                replacements: { steamid },
            }
        );

    return rows as ItemInfo[];
}

export async function updateItem(
    id: number,
    data: {
        className: string;
        code: string;
        days: number;
    }
): Promise<ItemInfo | null> {
    try {
        const days = Math.trunc(data.days);

        if (
            !Number.isInteger(days) ||
            days <= 0 ||
            days > 3650
        ) {
            return null;
        }

        await sequelize.query(
            `
            UPDATE items
            SET
                className = :className,
                code = :code,
                srok = DATE_ADD(
                    NOW(),
                    INTERVAL ${days} DAY
                )
            WHERE id = :id
            `,
            {
                replacements: {
                    id,
                    className:
                        data.className,
                    code: data.code,
                },
            }
        );

        return findItemById(id);
    } catch (error) {
        console.error(
            'Ошибка изменения item:',
            error
        );

        return null;
    }
}

export async function deleteItem(
    id: number
): Promise<boolean> {
    try {
        const [, metadata] =
            await sequelize.query(
                `
                DELETE FROM items
                WHERE id = :id
                `,
                {
                    replacements: { id },
                }
            );

        return Number(
            (metadata as any)?.affectedRows
        ) > 0;
    } catch (error) {
        console.error(
            'Ошибка удаления item:',
            error
        );

        return false;
    }
}

export async function deleteExpiredItems(): Promise<number> {
    try {
        const [, metadata] =
            await sequelize.query(
                `
                DELETE FROM items
                WHERE srok <= NOW()
                `
            );

        return Number(
            (metadata as any)?.affectedRows ?? 0
        );
    } catch (error) {
        console.error(
            'Ошибка удаления истёкших items:',
            error
        );

        return 0;
    }
}