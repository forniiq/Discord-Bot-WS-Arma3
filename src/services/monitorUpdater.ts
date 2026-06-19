// Мониторинг онлайна сервера

import { Client, EmbedBuilder, TextChannel, ActivityType } from "discord.js";
import { sendLog } from "@/utils/logger";
import { getOnlinePlayers, OnlinePlayer, getCurrentZbd, ZBDInfo } from "@/database/queries";
import { APPROVED_UNITS } from "@/config/units";
import { SLOT_ABBREVIATIONS } from "@/config/slots";

// Пик онлайна за день
let peakOnlineToday = 0;
let peakResetDate = new Date().toDateString();

// Запуск мониторинга
export async function StartMonitorUpdater(client: Client) {
    const channelId = process.env.MONITOR_CHANNEL_ID!;
    const messageId = process.env.MONITOR_MESSAGE_ID!;

    // Получение канала
    const channel = await client.channels.fetch(channelId);

    if (!channel || !channel.isTextBased()) {
        sendLog("ERROR", "Monitor", "Канал не найден или не текстовый");
        return;
    }

    const textChannel = channel as TextChannel;

    let message = null;

    // Попытка восстановить старое сообщение мониторингка
    if (isValidId(messageId)) {
        message = await textChannel.messages.fetch(messageId).catch(() => null);
    }

    // Если нет сообщения - создание нового
    if (!message) {
        const players = await getOnlinePlayers();
        const zbd = await getCurrentZbd();

        message = await textChannel.send({
            embeds: createEmbeds(players, zbd),
        });

        sendLog("INFO", "Monitor", `Создан новый мониторинг онлайна: ${message.id}`);
    }

    let isUpdating = false;

    // Основной цикл обновления мониторинга
    setInterval(async () => {
        if (isUpdating) return;
        isUpdating = true;

        try {
            // Получение актуального списка игроков и текущего ЗБД
            const players = await getOnlinePlayers();
            const zbd = await getCurrentZbd();

            // Обновление статуса бота
            const status =
                players.length === 0
                    ? "Сервер пуст"
                    : `${players.length} Игроков на сервере`;
            
            client.user?.setActivity(status, {
                type: ActivityType.Watching
            });

            if (!message) return;

            // Сброс дневного пика онлайна
            const today = new Date().toDateString();

            if (today !== peakResetDate) {
                peakResetDate = today;
                peakOnlineToday = players.length;
            }

            if (players.length > peakOnlineToday) {
                peakOnlineToday = players.length;
            }
            
            // Обновление Embed сообщения
            await message.edit({
                embeds: createEmbeds(players, zbd),
            });

        } catch (err) {
            console.error(err);
        } finally {
            isUpdating = false;
        }
    }, 30_000); // Обновление раз в 30 секунд
}


// Проверка валидности Discord message id
function isValidId(id: string | undefined): id is string {
    return !!id && id.length > 10;
}

// Цвет статуса Embed
function getStatusColor(online: number): number {
    if (online === 0)
        return 0x1f1f1f;

    if (online <= 10)
        return 0x533b2e;

    if (online <= 25)
        return 0x73603c;

    if (online <= 40)
        return 0x8a7445;

    if (online <= 55)
        return 0x556b4d;

    if (online <= 70)
        return 0x466e68;

    if (online <= 85)
        return 0x4b658f;

    if (online <= 100)
        return 0x66509a;

    return 0x7b3f8c;
}

// Текст статуса Embed
function getStatusText(online: number): string {
    if (online === 0) return "OFFLINE";

    if (online < 50) return "НИЗКАЯ АКТИВНОСТЬ";

    if (online < 100) return "СРЕДНЯЯ АКТИВНОСТЬ";

    return "ВЫСОКАЯ АКТИВНОСТЬ";
}

// Сокращение/Нормализация слота
function formatSlot(slot: string, maxLength = 19): string {
    const abbrev = SLOT_ABBREVIATIONS[slot];
    if (abbrev) return abbrev;

    return slot.length > maxLength
        ? slot.slice(0, maxLength - 1) + "…"
        : slot;
}

// Агрегация слотов
function getSlotStats(players: OnlinePlayer[]) {
    const slots = new Map<string, number>();

    for (const player of players) {
        const rawSlot = player.Slot;

        slots.set(
            rawSlot,
            (slots.get(rawSlot) || 0) + 1
        );
    }

    return [...slots.entries()]
        .sort((a, b) => b[1] - a[1]);
}

// Получение отряда из никнейма
function getPlayerUnit(name: string): string | null {
    const match = name.match(/^\[(.+?)\]/);

    if (!match?.[1]) {
        return null;
    }

    const unit = match[1].trim();

    return APPROVED_UNITS.has(unit)
        ? unit
        : null;
}

// Агрегация отрядов
function getUnitStats(players: OnlinePlayer[]) {

    const units = new Map<string, number>();

    for (const player of players) {

        const unit = getPlayerUnit(player.pName);

        if (!unit)
            continue;

        units.set(
            unit,
            (units.get(unit) || 0) + 1
        );
    }

    return [...units.entries()]
        .sort((a, b) => b[1] - a[1]);
}

// Выравнивание колонок (Для Embed)
function normalizeColumns(left: string[], right: string[]) {
    const max = Math.max(left.length, right.length);

    const l = [...left];
    const r = [...right];

    while (l.length < max) l.push(" ");
    while (r.length < max) r.push(" ");

    return { l, r };
}

// Прогресс бар онлайна
function createProgressBar(
    current: number,
    max: number
) {
    const size = 20;

    const filled = Math.round(
        current / max * size
    );

    return (
        "█".repeat(filled) +
        "░".repeat(size - filled)
    );
}

function formatTime(seconds: number) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    return `${h}ч ${m}м ${s}с`;
}

// Сбор всех Embed`ов
function createEmbeds(players: OnlinePlayer[], zbd: ZBDInfo | null): EmbedBuilder[] {
    players.sort(
        (a, b) => b.pLvlSort - a.pLvlSort
    );

    const online = players.length;
    const color = getStatusColor(online);

    return [
        createHeaderEmbed(online, zbd, color),
        createSlotsEmbed(players, color),
        ...createPlayerEmbeds(players, color)
    ];
}

// Шапка мониторинга (общая информация)
function createHeaderEmbed(online: number, zbd: ZBDInfo | null, color: number): EmbedBuilder {
    const unix = Math.floor(Date.now() / 1000);

    const zbdTime = zbd ? formatTime(zbd.Time) : "—";

    const zbdCity = zbd?.City ?? "—";
    

    return new EmbedBuilder()
        .setColor(color)
        .setTitle("🌐 «Спектр Войны» Мониторинг Онлайна")
        .setDescription(
            [
                "```yaml",
                `СТАТУС         | ${getStatusText(online)}`,
                `ОНЛАЙН         | ${online}/${zbd?.MaxPlayers ?? 0}`,
                `ПИК ЗА СУТКИ   | ${peakOnlineToday}`,
                `СЕРВЕР         | ${process.env.SERVER_IP}:${process.env.SERVER_PORT}`,
                `НАГРУЗКА       | ${createProgressBar(online, zbd?.MaxPlayers ?? 0)}`,
                `               |`,
                `ГОРОД          | ${zbdCity}`,
                `ВРЕМЯ БД       | ${zbdTime}`,
                `FPS СЕРВЕРА    | ${zbd?.FPS ?? "—"}`,
                "```",
                "",
                `🕒 Обновлено: <t:${unix}:R>`
            ].join("\n")
        )
        .setFooter({
            text: "Спектр Войны • Live Monitor"
        });
}

// Статистика слотов и отрядов
function createSlotsEmbed(players: OnlinePlayer[], color: number): EmbedBuilder {
    const SLOT_COL_WIDTH = 14;
    const slots = getSlotStats(players)
        .slice(0, 15)
        .map(([slot, count]) =>
            `${String(count).padStart(2)} │ ${formatSlot(slot).padEnd(SLOT_COL_WIDTH)}`
        );

    const units = getUnitStats(players)
        .map(([unit, count]) =>
            `${String(count).padStart(2)} │ ${unit}`
        );

    const { l: slotsCol, r: unitsCol } = normalizeColumns(slots, units);

    return new EmbedBuilder()
        .setColor(color)
        .setTitle("⚙️ Статистика подразделений")
        .addFields(
            {
                name: "🎯 Слоты",
                value: `\`\`\`\n${slotsCol.join("\n")}\n\`\`\``,
                inline: true
            },
            {
                name: "🪖 Отряды",
                value: `\`\`\`\n${unitsCol.join("\n")}\n\`\`\``,
                inline: true
            }
        );
}

// Список игроков
function createPlayerEmbeds(players: OnlinePlayer[], color: number): EmbedBuilder[] {
    const embeds: EmbedBuilder[] = [];

    const chunkSize = 40;

    for (let i = 0; i < players.length; i += chunkSize) {

        const chunk = players.slice(i, i + chunkSize);

        const ranks = chunk
            .map(p => p.pLvl)
            .join("\n");

        const names = chunk
            .map(p => p.pName.substring(0, 18))
            .join("\n");

        const slots = chunk
            .map(p => formatSlot(p.Slot))
            .join("\n");

        embeds.push(
            new EmbedBuilder()
                .setColor(color)
                .setTitle(
                    `🪖 Личный состав (${i + 1}-${Math.min(i + chunkSize, players.length)})`
                )
                .addFields(
                    {
                        name: "📛 Звание",
                        value: `\`\`\`\n${ranks}\n\`\`\``,
                        inline: true
                    },
                    {
                        name: "👤 Игрок",
                        value: `\`\`\`\n${names}\n\`\`\``,
                        inline: true
                    },
                    {
                        name: "🎯 Слот",
                        value: `\`\`\`\n${slots}\n\`\`\``,
                        inline: true
                    }
                )
        );
    }

    return embeds;
}