import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import { getBankBalance } from '../database/queries';
import { SERVER_CONFIG } from '@/config/server.config';
import {
    getMessageId,
    setMessageId
} from '@/utils/message-state';

const BANK_CHANNEL_ID = SERVER_CONFIG.discord.channels.bank;

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
        const bankMessageId = getMessageId('bank');

        if (bankMessageId) {
            message = await textChannel.messages
                .fetch(bankMessageId)
                .catch(() => null);
        }

        if (message) {
            await message.edit({ embeds: [bankEmbed] });
        } else {
            const newMessage = await textChannel.send({
                embeds: [bankEmbed]
            });

            setMessageId('bank', newMessage.id);

            console.log(
                `✅ [BankService] Создано новое банковое сообщение: ${newMessage.id}`
            );
        }

        // Обновляем кэш баланса только ПОСЛЕ успешной отправки/изменения
        lastKnownBalance = currentBalance;

    } catch (error) {
        console.error('❌ Ошибка при обновлении отображения банка:', error);
    }
}

// Запускает постоянный цикл проверки банка
export async function startBankAutoSync(client: Client) {
    // Первоначальный запуск
    await updateBankDisplay(client);

    setInterval(async () => {
        await updateBankDisplay(client);
    }, SERVER_CONFIG.bank.updateInterval);
}