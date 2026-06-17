import { Client, EmbedBuilder, TextChannel } from "discord.js";
import { sendLog } from "@/utils/logger";
import { getOnlinePlayers, OnlinePlayer } from "@/database/queries";

let lastHash = "";

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


    // Основной цикл обновления мониторинга
    setInterval(async () => {
        try {
            const players = await getOnlinePlayers();

            const currentHash = buildHash(players);

            if (currentHash === lastHash) return;

            lastHash = currentHash;

            await message.edit({
                embeds: createEmbeds(players),
            });

        } catch (err) {
            sendLog("ERROR", "Monitor", String(err));
        }
    }, 15_000);
}

function isValidId(id: string | undefined): id is string {
    return !!id && id.length > 10;
}

// Создание Hash текущего списка игроков
function buildHash(players: OnlinePlayer[]): string {
    return JSON.stringify(
        players.map(p => ({
            name: p.pName,
            rank: p.pLvlSort,
            slot: p.Slot
        }))
    );
}

// Цвет статуса Embed
function getStatusColor(online: number): number {
    if (online === 0) return 0x3b3b3b;

    if (online < 20) return 0x7c6f3a;

    if (online < 50) return 0xb8742a;

    return 0xa83232;
}

// Текст статуса Embed
function getStatusText(online: number): string {
    if (online === 0) return "OFFLINE";

    if (online < 20) return "НИЗКАЯ АКТИВНОСТЬ";

    if (online < 50) return "СРЕДНЯЯ АКТИВНОСТЬ";

    return "ВЫСОКАЯ АКТИВНОСТЬ";
}

// Главная функция генерации Embed
function createEmbeds(players: OnlinePlayer[]): EmbedBuilder[] {
    const online = players.length;
    const color = getStatusColor(online);

    return [
        createHeaderEmbed(players.length, color),
        ...createPlayerEmbeds(players, color)
    ];
}

// Шапка мониторинга
function createHeaderEmbed(online: number, color: number): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(color)
        .setTitle("🌐 WarSpectra Online Monitor")
        .setDescription(
            [
                "```yaml",
                `STATUS : ${getStatusText(online)}`,
                `ONLINE : ${online} ИГРОКОВ`,
                `SERVER : ${process.env.SERVER_IP}:${process.env.SERVER_PORT}`,
                "```"
            ].join("\n")
        )
        .setTimestamp()
        .setFooter({ text: "Спектр Войны" });
}

// Создание Embed - Списка игроков
function createPlayerEmbeds(players: OnlinePlayer[], color: number): EmbedBuilder[] {
    const embeds: EmbedBuilder[] = [];

    const chunkSize = 20; // меньше = аккуратнее UI

    for (let i = 0; i < players.length; i += chunkSize) {
        const chunk = players.slice(i, i + chunkSize);

        const value = chunk
            .map(p => {
                return `**${p.pName}** | ${p.pLvl} | \`${p.Slot}\``;
            })
            .join("\n");

        embeds.push(
            new EmbedBuilder()
                .setColor(color)
                .setTitle(`🪖 Личный состав (${i + 1}-${Math.min(i + chunkSize, players.length)})`)
                .addFields({
                    name: "Звание | Игрок | Слот",
                    value: value || "Нет данных"
                })
        );
    }

    return embeds;
}