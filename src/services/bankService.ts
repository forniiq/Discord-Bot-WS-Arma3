// Обновляет отображение банка в Discord

import { Client, EmbedBuilder, TextChannel, VoiceChannel } from 'discord.js';
import { getBankBalance } from '../database/queries';

const BANK_CHANNEL_ID = process.env.BANK_CHANNEL_ID as string; // ID канала банка
const BANK_MESSAGE_ID = process.env.BANK_MESSAGE_ID as string; // (Опционально) ID Embed-сообщения

let lastKnownBalance: number | null = null;

export async function updateBankDisplay(client: Client): Promise<void> {
    if (!BANK_CHANNEL_ID) return;

    try {
        const currentBalance = await getBankBalance();

        // Если баланс не изменился — пропускаем (защита от лимитов Discord API)
        if (lastKnownBalance === currentBalance) return;

        const channel = client.channels.cache.get(BANK_CHANNEL_ID) || 
                        await client.channels.fetch(BANK_CHANNEL_ID).catch(() => null);

        if (!channel) return;

        const formattedBalance = currentBalance.toLocaleString('ru-RU');

        // Вариант Б: Обновление Embed-сообщения в текстовом канале
        if (channel.isTextBased() && BANK_MESSAGE_ID) {
            const message = await channel.messages.fetch(BANK_MESSAGE_ID).catch(() => null);
            
            if (message) {
                const bankEmbed = new EmbedBuilder()
                    .setTitle('🏛️ Банк Опыта War Spectra')
                    .setColor('#f39c12')
                    .setDescription(`Текущий фонд казны составляет:\n\n# 💰 **${formattedBalance} EXP**`)
                    .setFooter({ text: 'Синхронизировано с игровой базой данных' })
                    .setTimestamp();

                await message.edit({ embeds: [bankEmbed] });
            }
        }

        lastKnownBalance = currentBalance;
    } catch (error) {
        console.error('Ошибка при обновлении отображения банка:', error);
    }
}


// Запускает постоянный цикл проверки банка
export async function startBankAutoSync(client: Client, intervalMs: number = 30_000) {
    // Первоначальный запуск
    await updateBankDisplay(client);

    setInterval(async () => {
        await updateBankDisplay(client);
    }, intervalMs);
}