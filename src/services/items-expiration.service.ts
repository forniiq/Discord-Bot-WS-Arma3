import { cleanupExpiredItems } from '@/services/items.service';
import { sendLog } from '@/utils/logger.utils';

let expirationTimer: NodeJS.Timeout | null = null;

export async function runItemsExpirationCheck() {
    try {
        const deleted =
            await cleanupExpiredItems();

        if (deleted > 0) {
            await sendLog(
                'INFO',
                'Items',
                `Автоматически удалено просроченных Items: ${deleted}`
            );
        }
    } catch (error) {
        await sendLog(
            'ERROR',
            'Items',
            `Ошибка автоматического удаления просроченных Items: ${error}`
        );
    }
}

export function startItemsExpirationJob() {
    if (expirationTimer) {
        return;
    }

    void runItemsExpirationCheck();

    expirationTimer = setInterval(
        () => {
            void runItemsExpirationCheck();
        },
        24 * 60 * 60 * 1000
    );
}