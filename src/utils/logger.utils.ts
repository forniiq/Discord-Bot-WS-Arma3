import { Client, EmbedBuilder, ChannelType, ColorResolvable } from 'discord.js';
import { Logger } from 'commandkit/logger';
import * as fs from 'fs';
import * as path from 'path';
import { SERVER_CONFIG } from '@/config/server.config';

const LOGS_CHANNEL_ID = SERVER_CONFIG.discord.channels.logs as string;

// Путь к файлу логов в корне проекта
const LOG_FILE_PATH = path.join(process.cwd(), 'bot.log');

// Поклинка текста от Discord-тегов (<@ID>, <#ID>, <@&ID>, backticks) для чистого файла
function cleanDiscordFormatting(text: string): string {
    return text
        .replace(/<@!?(\d+)>/g, 'User($1)')
        .replace(/<#(\d+)>/g, 'Channel($1)')
        .replace(/<@&(\d+)>/g, 'Role($1)')
        .replace(/`{1,3}/g, '')
        .trim();
}

// Запись строки в файл bot.log
function writeToFile(line: string) {
    const timestamp = new Date().toISOString();
    const formattedLine = `[${timestamp}] ${line}\n`;

    fs.appendFile(LOG_FILE_PATH, formattedLine, 'utf8', (err) => {
        if (err) {
            Logger.error(`[FILE_LOGGER] Ошибка записи в файл: ${err}`);
        }
    });
}

type LogLevel = 'INFO' | 'WARN' | 'ERROR';

const LOG_CONFIG = {
    INFO: { color: '#57f287', emoji: 'ℹ️', title: 'Информационный лог' },
    WARN: { color: '#fee75c', emoji: '⚠️', title: 'Предупреждение' },
    ERROR: { color: '#ed4245', emoji: '❌', title: 'Ошибка системы' }
};

let discordClient: Client | null = null;

export function initLogger(client: Client) {
    discordClient = client;
}

// Стандартный системный логгер
export async function sendLog(level: LogLevel, context: string, message: string) {
    const timestamp = new Date().toLocaleString('ru-RU');
    const config = LOG_CONFIG[level];

    const consoleText = `[${timestamp}] [${level}] [${context}] ${message}`;
    if (level === 'ERROR') console.error(consoleText);
    else if (level === 'WARN') console.warn(consoleText);
    else console.log(consoleText);

    // Логирование в файл
    writeToFile(`[SYSTEM] [${level}] [${context}] ${cleanDiscordFormatting(message)}`);

    if (!discordClient) return;

    try {
        const channel = discordClient.channels.cache.get(LOGS_CHANNEL_ID) || await discordClient.channels.fetch(LOGS_CHANNEL_ID);
        if (!channel || channel.type !== ChannelType.GuildText) return;

        const logEmbed = new EmbedBuilder()
            .setTitle(`${config.emoji} ${config.title}`)
            .setColor(config.color as ColorResolvable)
            .addFields(
                { name: '📂 Модуль', value: `\`${context}\``, inline: true },
                { name: '📊 Уровень', value: `\`${level}\``, inline: true },
                { name: '💬 Сообщение', value: `\`\`\`${message.slice(0, 1900)}\`\`\``, inline: false }
            )
            .setTimestamp();

        await channel.send({ embeds: [logEmbed] }).catch(() => null);
    } catch (err) {
        Logger.error(`[LOGGER] Ошибка отправки лога: ${err}`);
    }
}

// Логирование действий администрации (Аудит)
export async function sendAdminLog(options: {
    title: string;
    description: string;
    color?: ColorResolvable;
    fields?: { name: string; value: string; inline?: boolean }[];
    executorId?: string;
    targetThumbnail?: string;
}) {
    // 1. Формируем текстовое представление для файла
    const logDetails = options.fields
        ? options.fields.map(f => `${f.name}: ${f.value}`).join(' | ')
        : '';
    
    const rawFileMessage = `[ADMIN_AUDIT] ${options.title} -> ${options.description}${logDetails ? ` | ${logDetails}` : ''}${options.executorId ? ` (Исполнитель: ${options.executorId})` : ''}`;
    
    // Записываем чистый текст в локальный файл
    writeToFile(cleanDiscordFormatting(rawFileMessage));

    // 2. Отправка в Discord
    if (!discordClient) {
        Logger.error('[ADMIN_LOGGER] Ошибка: discordClient ещё не инициализирован! Вызван ли initLogger(client)?');
        return;
    }

    try {
        const channel = discordClient.channels.cache.get(LOGS_CHANNEL_ID) || await discordClient.channels.fetch(LOGS_CHANNEL_ID).catch(() => null);
        
        if (!channel) {
            Logger.error(`[ADMIN_LOGGER] Канал с ID ${LOGS_CHANNEL_ID} не найден! Проверьте LOGS_CHANNEL_ID в .env`);
            return;
        }

        if (channel.type !== ChannelType.GuildText) {
            Logger.error(`[ADMIN_LOGGER] Канал ${LOGS_CHANNEL_ID} не является текстовым каналом!`);
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle(options.title)
            .setDescription(options.description)
            .setColor(options.color || '#2b2d31')
            .setTimestamp();

        if (options.fields) {
            embed.addFields(options.fields);
        }

        if (options.executorId) {
            embed.setFooter({ text: `ID Исполнителя: ${options.executorId}` });
        }

        if (options.targetThumbnail) {
            embed.setThumbnail(options.targetThumbnail);
        }

        await channel.send({ embeds: [embed] });
    } catch (err) {
        Logger.error(`[ADMIN_LOGGER] Ошибка отправки сообщения в канал: ${err}`);
    }
}