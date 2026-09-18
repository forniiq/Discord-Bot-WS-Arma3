import { sequelize } from '../connect';

export interface ItemInfo {
    id: number;
    steamid: string;
    className: string;
    code: string;
    insert_at: Date;
    srok: Date;
}

export async function getItemsBySteamId(
    steamid: string
): Promise<ItemInfo[]> {
    const [rows] = await sequelize.query(
        `
        SELECT
            id,
            steamid,
            className,
            code,
            insert_at,
            srok
        FROM items
        WHERE steamid = :steamid
        ORDER BY srok ASC, id ASC
        `,
        {
            replacements: { steamid },
        }
    );

    return rows as ItemInfo[];
}

export async function getItemById(
    id: number
): Promise<ItemInfo | null> {
    const [rows] = await sequelize.query(
        `
        SELECT
            id,
            steamid,
            className,
            code,
            insert_at,
            srok
        FROM items
        WHERE id = :id
        LIMIT 1
        `,
        {
            replacements: { id },
        }
    );

    return (rows as ItemInfo[])[0] ?? null;
}

export async function createItem(data: {
    steamid: string;
    className: string;
    code: string;
    srok: Date;
}): Promise<ItemInfo | null> {
    const [result] = await sequelize.query(
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
            :srok
        )
        `,
        {
            replacements: data,
        }
    );

    const insertId = (result as any)?.insertId;

    if (!insertId) {
        return null;
    }

    return getItemById(Number(insertId));
}

export async function updateItem(
    id: number,
    data: {
        className: string;
        code: string;
        srok: Date;
    }
): Promise<boolean> {
    try {
        const [, metadata] = await sequelize.query(
            `
            UPDATE items
            SET
                className = :className,
                code = :code,
                srok = :srok
            WHERE id = :id
            `,
            {
                replacements: {
                    id,
                    ...data,
                },
            }
        );

        return Number((metadata as any)?.affectedRows ?? 0) > 0;
    } catch (error) {
        console.error('Ошибка при обновлении item:', error);
        return false;
    }
}

export async function deleteItem(
    id: number
): Promise<boolean> {
    try {
        const [, metadata] = await sequelize.query(
            `
            DELETE FROM items
            WHERE id = :id
            `,
            {
                replacements: { id },
            }
        );

        return Number((metadata as any)?.affectedRows ?? 0) > 0;
    } catch (error) {
        console.error('Ошибка при удалении item:', error);
        return false;
    }
}

export async function deleteExpiredItems(): Promise<number> {
    try {
        const [, metadata] = await sequelize.query(
            `
            DELETE FROM items
            WHERE srok <= NOW()
            `
        );

        return Number((metadata as any)?.affectedRows ?? 0);
    } catch (error) {
        console.error('Ошибка при удалении истёкших items:', error);
        return 0;
    }
}