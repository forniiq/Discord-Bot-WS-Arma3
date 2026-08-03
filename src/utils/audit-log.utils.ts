import {
    AuditLogEvent,
    Guild,
    GuildAuditLogsEntry
} from 'discord.js';

export async function getExecutor(
    guild: Guild,
    action: AuditLogEvent,
    targetId: string
): Promise<GuildAuditLogsEntry | null> {

    try {
        const logs = await guild.fetchAuditLogs({
            limit: 10,
            type: action
        });

        const entry = logs.entries.find(
            (log) =>
                log.targetId === targetId &&
                Date.now() - log.createdTimestamp < 5000
        );

        return entry ?? null;

    } catch {
        return null;
    }
}