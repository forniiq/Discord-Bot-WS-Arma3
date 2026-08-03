import { Client } from 'discord.js';
import { getLastUnprocessedZbd, markZbdProcessed, markAllOldZbdProcessed } from '@/database/queries';
import { createZbdEmbed } from '../../zbd-embed';

const ZBD_CHANNEL_ID = process.env.ZBD_CHANNEL_ID as string;
const CHECK_INTERVAL_MS = 30 * 1000; // Проверка каждые 30 секунд

export async function startZbdChecker(client: Client, skipOldOnStart: boolean = false): Promise<void> {
    if (skipOldOnStart) {
        await markAllOldZbdProcessed();
    }

    setInterval(async () => {
        try {
            // Берем самое последнее ЗБД
            const zbd = await getLastUnprocessedZbd();
            if (!zbd || !zbd.Date) return;

            const channel = await client.channels.fetch(ZBD_CHANNEL_ID).catch(() => null);

            if (!channel || !channel.isSendable()) {
                console.error(`[ZBD Checker] Канал ${ZBD_CHANNEL_ID} не найден или недоступен.`);
                return;
            }

            // Отправляем Embed с последним ЗБД
            const embed = createZbdEmbed(zbd);
            await channel.send({ embeds: [embed] });

            await markZbdProcessed(zbd.Date);
        } catch (error) {
            console.error('[ZBD Checker] Ошибка при обработке ЗБД:', error);
        }
    }, CHECK_INTERVAL_MS);
}