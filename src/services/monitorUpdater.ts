import { Client, EmbedBuilder, TextChannel, ActivityType } from "discord.js";
import { sendLog } from "@/utils/logger";
import { getOnlinePlayers, OnlinePlayer } from "@/database/queries";
import { APPROVED_UNITS } from "@/config/units";

const MAX_PLAYERS = 115;

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

    // Поиск старого сообщения
    if (isValidId(messageId)) {
        message = await textChannel.messages.fetch(messageId).catch(() => null);
    }

    // Создание нового сообщения
    if (!message) {
        const players = await getOnlinePlayers();

        message = await textChannel.send({
            embeds: createEmbeds(players),
        });

        sendLog("INFO", "Monitor", `Создан новый мониторинг онлайна: ${message.id}`);
    }

    let isUpdating = false;

    // Основной цикл обновления мониторинга
    setInterval(async () => {
        if (isUpdating) return;
        isUpdating = true;

        try {
            const players = await getOnlinePlayers();

            const status =
                players.length === 0
                    ? "Сервер пуст"
                    : `${players.length} Игроков на сервере`;

            client.user?.setActivity(status, {
                type: ActivityType.Watching
            });

            if (!message) return;

            const today = new Date().toDateString();

            if (today !== peakResetDate) {
                peakResetDate = today;
                peakOnlineToday = players.length;
            }

            if (players.length > peakOnlineToday) {
                peakOnlineToday = players.length;
            }
            
            await message.edit({
                embeds: createEmbeds(players),
            });

        } catch (err) {
            console.error(err);
        } finally {
            isUpdating = false;
        }
    }, 30_000);
}

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

function getSlotStats(players: OnlinePlayer[]) {
    const slots = new Map<string, number>();

    for (const player of players) {
        slots.set(
            player.Slot,
            (slots.get(player.Slot) || 0) + 1
        );
    }

    return [...slots.entries()]
        .sort((a, b) => b[1] - a[1]);
}

// Получение отряда
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

// Получение списка отрядов
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

// Нормализация длинны списков
function normalizeColumns(left: string[], right: string[]) {
    const max = Math.max(left.length, right.length);

    const l = [...left];
    const r = [...right];

    while (l.length < max) l.push(" ");
    while (r.length < max) r.push(" ");

    return { l, r };
}

// Создание Progress Bar
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

// Главная функция генерации Embed
function createEmbeds(players: OnlinePlayer[]): EmbedBuilder[] {
    players.sort(
        (a, b) => b.pLvlSort - a.pLvlSort
    );

    const online = players.length;
    const color = getStatusColor(online);

    return [
        createHeaderEmbed(online, color),
        createSlotsEmbed(players, color),
        ...createPlayerEmbeds(players, color)
    ];
}

// Шапка мониторинга
function createHeaderEmbed(online: number, color: number): EmbedBuilder {
    const unix = Math.floor(Date.now() / 1000);

    return new EmbedBuilder()
        .setColor(color)
        .setTitle("🌐 «Спектр Войны» Мониторинг Онлайна")
        .setDescription(
            [
                "```yaml",
                `STATUS      | ${getStatusText(online)}`,
                `ONLINE      | ${online}/${MAX_PLAYERS}`,
                `PEAK TODAY  | ${peakOnlineToday}`,
                `SERVER      | ${process.env.SERVER_IP}:${process.env.SERVER_PORT}`,
                `LOAD        | ${createProgressBar(online, MAX_PLAYERS)}`,
                "```",
                "",
                `🕒 Обновлено: <t:${unix}:R>`
            ].join("\n")
        )
        .setFooter({
            text: "Спектр Войны • Live Monitor"
        });
}

function createSlotsEmbed(players: OnlinePlayer[], color: number): EmbedBuilder {
    const slots = getSlotStats(players)
        .slice(0, 15)
        .map(([slot, count]) =>
            `${String(count).padStart(2)} │ ${slot}`
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

// Создание Embed - Списка игроков
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
            .map(p => p.Slot)
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