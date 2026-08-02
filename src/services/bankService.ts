import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import { getBankBalance } from '../database/queries';
import { sendLog } from '../utils/logger'; // или console.error

const BANK_CHANNEL_ID = process.env.BANK_CHANNEL_ID as string;
let BANK_MESSAGE_ID = process.env.BANK_MESSAGE_ID as string | undefined;

let lastKnownBalance: number | null = null;

export async function updateBankDisplay(client: Client): Promise<void> {
    if (!BANK_CHANNEL_ID) {
        console.warn('⚠️ [BankService] BANK_CHANNEL_ID не указан в .env!');
        return;
    }

    try {
        const currentBalance = await getBankBalance();

        // 1. Пропускаем, если баланс не менялся и сообщение уже существует
        if (lastKnownBalance === currentBalance) return;

        // 2. Получаем канал
        const channel = client.channels.cache.get(BANK_CHANNEL_ID) || 
                        await client.channels.fetch(BANK_CHANNEL_ID).catch(() => null);

        if (!channel || !channel.isTextBased()) {
            console.error(`❌ [BankService] Канал ${BANK_CHANNEL_ID} не найден или не является текстовым!`);
            return;
        }

        const textChannel = channel as TextChannel;
        const formattedBalance = currentBalance.toLocaleString('ru-RU');

        const bankEmbed = new EmbedBuilder()
            .setTitle('🏛️ Банк Опыта War Spectra')
            .setColor('#f39c12')
            .setDescription(`Текущий фонд казны составляет:\n\n# 💰 **${formattedBalance} EXP**`)
            .setFooter({ text: 'Синхронизировано с игровой базой данных' })
            .setTimestamp();

        let message = null;

        // 3. Пытаемся найти существующее сообщение
        if (BANK_MESSAGE_ID) {
            message = await textChannel.messages.fetch(BANK_MESSAGE_ID).catch(() => null);
        }

        if (message) {
            // Если сообщение существует — редактируем
            await message.edit({ embeds: [bankEmbed] });
        } else {
            // Если сообщения нет — отправляем новое!
            const newMessage = await textChannel.send({ embeds: [bankEmbed] });
            BANK_MESSAGE_ID = newMessage.id;
            console.log(`✅ [BankService] Отправлено новое банковое сообщение! Сохраните этот ID в .env: BANK_MESSAGE_ID=${newMessage.id}`);
        }

        // Обновляем кэш баланса только ПОСЛЕ успешной отправки/изменения
        lastKnownBalance = currentBalance;

    } catch (error) {
        console.error('❌ Ошибка при обновлении отображения банка:', error);
    }
}

// Запускает постоянный цикл проверки банка
export async function startBankAutoSync(client: Client, intervalMs: number = 60_000) {
    // Первоначальный запуск
    await updateBankDisplay(client);

    setInterval(async () => {
        await updateBankDisplay(client);
    }, intervalMs);
}