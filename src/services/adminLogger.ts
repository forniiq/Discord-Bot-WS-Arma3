import { Client, AuditLogEvent, Message, PartialMessage, GuildMember, PartialGuildMember, GuildBan } from 'discord.js';
import { sendAdminLog } from '@/utils/logger';
import { getExecutor } from '@/utils/auditLog';

export function setupAdminLogging(client: Client) {

    // 1. Лог удаления сообщения
    client.on('messageDelete', async (message: Message | PartialMessage) => {
        if (message.partial || !message.guild || message.author?.bot) return;

        const auditEntry = await getExecutor(message.guild, AuditLogEvent.MessageDelete, message.author.id);
        const executor =
            auditEntry &&
            auditEntry.extra &&
            'channel' in auditEntry.extra &&
            auditEntry.extra.channel?.id === message.channel.id
                ? auditEntry.executor
                : message.author;

        const content = message.content || '*[Содержимое недоступно / Вложение]*';

        await sendAdminLog({
            title: '🗑️ Удаление сообщения',
            description: `Сообщение, отправленное <@${message.author.id}> (\`${message.author.tag}\`), было удалено в ${message.channel}`,
            color: '#ed4245',
            fields: [
                { name: '👤 Кто удалил', value: executor ? `<@${executor.id}> (\`${executor.tag}\`)` : 'Неизвестно', inline: true },
                { name: '📜 Содержание', value: `\`\`\`${content.slice(0, 1000)}\`\`\``, inline: false },
            ],
            executorId: executor?.id,
        });
    });

    // 2. Лог смены никнейма
    client.on('guildMemberUpdate', async (oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) => {
        if (oldMember.nickname !== newMember.nickname) {
            const auditEntry = await getExecutor(newMember.guild, AuditLogEvent.MemberUpdate, newMember.id);
            const executor = auditEntry?.executor || newMember.user;

            const oldNick = oldMember.nickname || oldMember.user.username;
            const newNick = newMember.nickname || newMember.user.username;

            await sendAdminLog({
                title: '🏷️ Изменение никнейма',
                description: `Никнейм участника <@${newMember.id}> (\`${newMember.user.tag}\`) был изменен`,
                color: '#3498db',
                fields: [
                    { name: 'Старый никнейм', value: `\`${oldNick}\``, inline: true },
                    { name: 'Новый никнейм', value: `\`${newNick}\``, inline: true },
                    { name: 'Кто изменил', value: `<@${executor.id}> (\`${executor.tag}\`)`, inline: false },
                ],
                targetThumbnail: newMember.user.displayAvatarURL(),
                executorId: executor.id,
            });
        }
    });

    // 3. Лог бана участника
    client.on('guildBanAdd', async (ban: GuildBan) => {
        const auditEntry = await getExecutor(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id);
        const executor = auditEntry?.executor;
        const reason = ban.reason || auditEntry?.reason || 'Причина не указана';

        await sendAdminLog({
            title: '🔨 Блокировка участника',
            description: `Участник <@${ban.user.id}> (\`${ban.user.tag}\`) был забанен`,
            color: '#992d22',
            fields: [
                { name: 'Модератор', value: executor ? `<@${executor.id}> (\`${executor.tag}\`)` : 'Неизвестно', inline: true },
                { name: 'Причина', value: `\`${reason}\``, inline: true },
            ],
            targetThumbnail: ban.user.displayAvatarURL(),
            executorId: executor?.id,
        });
    });

    // 4. Лог разбана участника
    client.on('guildBanRemove', async (ban: GuildBan) => {
        const auditEntry = await getExecutor(ban.guild, AuditLogEvent.MemberBanRemove, ban.user.id);
        const executor = auditEntry?.executor;

        await sendAdminLog({
            title: '🔓 Разблокировка участника',
            description: `Участник <@${ban.user.id}> (\`${ban.user.tag}\`) был разбанен`,
            color: '#2ecc71',
            fields: [
                { name: 'Модератор', value: executor ? `<@${executor.id}> (\`${executor.tag}\`)` : 'Неизвестно', inline: true },
            ],
            targetThumbnail: ban.user.displayAvatarURL(),
            executorId: executor?.id,
        });
    });
}