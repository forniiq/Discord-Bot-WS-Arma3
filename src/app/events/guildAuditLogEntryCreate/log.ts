import type { EventHandler } from 'commandkit';
import { AuditLogEvent } from 'discord.js';
import { sendAdminLog } from '@/utils/logger';

const handler: EventHandler<'guildAuditLogEntryCreate'> = async (auditLogEntry, guild) => {
    const { action, reason, changes, targetId, executorId, extra } = auditLogEntry;

    // 1. Получаем executor или фетчим его при отсутствии в кэше
    let executor = auditLogEntry.executor;

    if (!executor && executorId) {
        try {
            executor = await guild.client.users.fetch(executorId);
        } catch {
            executor = null;
        }
    }

    // Игнорируем действия ботов (опционально, уберите если нужны логи ботов)
    if (executor?.bot) return;

    // Безопасное формирование упоминаний и тегов
    const executorTag = executor && 'tag' in executor && executor.tag ? `\`${executor.tag}\`` : 'Неизвестный модератор';
    const executorMention = executor ? `<@${executor.id}>` : (executorId ? `<@${executorId}>` : 'Неизвестно');

    switch (action) {
        // ==========================================
        // 🏠 НАСТРОЙКИ СЕРВЕРА
        // ==========================================

        case AuditLogEvent.GuildUpdate: {
            if (!changes) break;

            const fields: { name: string; value: string; inline?: boolean }[] = [];

            for (const change of changes) {
                switch (change.key) {
                    case 'name':
                        fields.push({ name: '📝 Название сервера', value: `\`${change.old}\` ➔ \`${change.new}\`` });
                        break;
                    case 'afk_channel_id':
                        fields.push({ name: '💤 AFK Канал', value: `<#${change.old}> ➔ <#${change.new}>` });
                        break;
                    case 'afk_timeout':
                        fields.push({ name: '⏱️ Таймаут AFK', value: `\`${change.old} сек\` ➔ \`${change.new} сек\`` });
                        break;
                    case 'verification_level':
                        fields.push({ name: '🔒 Уровень проверки', value: `\`${change.old}\` ➔ \`${change.new}\`` });
                        break;
                    case 'icon_hash':
                        fields.push({ name: '🖼️ Иконка сервера', value: 'Была обновлена иконка сервера.' });
                        break;
                }
            }

            if (fields.length > 0) {
                await sendAdminLog({
                    title: '⚙️ Изменение настроек сервера',
                    description: `Модератор ${executorMention} изменил настройки сервера.`,
                    color: '#f1c40f',
                    fields,
                    executorId: executorId || executor?.id,
                });
            }
            break;
        }

        // ==========================================
        // 👥 ДЕЙСТВИЯ С УЧАСТНИКАМИ СЕРВЕРА
        // ==========================================

        // 🗑️ Удаление сообщения
        case AuditLogEvent.MessageDelete: {
            await sendAdminLog({
                title: '🗑️ Удаление сообщения модератором',
                description: `Модератор ${executorMention} (${executorTag}) удалил сообщение пользователя <@${targetId}>.`,
                color: '#ed4245',
                executorId: executorId || executor?.id,
            });
            break;
        }

        // 🔨 Бан участника
        case AuditLogEvent.MemberBanAdd: {
            await sendAdminLog({
                title: '🔨 Блокировка участника',
                description: `Участник <@${targetId}> был забанен на сервере.`,
                color: '#992d22',
                fields: [
                    { name: '🛡️ Модератор', value: `${executorMention} (${executorTag})`, inline: true },
                    { name: '📝 Причина', value: `\`${reason || 'Не указана'}\``, inline: true }
                ],
                executorId: executorId || executor?.id,
            });
            break;
        }

        // 🔓 Разбан участника
        case AuditLogEvent.MemberBanRemove: {
            await sendAdminLog({
                title: '🔓 Разблокировка участника',
                description: `С участника <@${targetId}> была снята блокировка.`,
                color: '#2ecc71',
                fields: [
                    { name: '🛡️ Модератор', value: `${executorMention} (${executorTag})`, inline: true }
                ],
                executorId: executorId || executor?.id,
            });
            break;
        }

        // 👢 Кик участника
        case AuditLogEvent.MemberKick: {
            await sendAdminLog({
                title: '👢 Исключение участника (Kick)',
                description: `Участник <@${targetId}> был кикнут с сервера.`,
                color: '#e67e22',
                fields: [
                    { name: '🛡️ Модератор', value: `${executorMention} (${executorTag})`, inline: true },
                    { name: '📝 Причина', value: `\`${reason || 'Не указана'}\``, inline: true }
                ],
                executorId: executorId || executor?.id,
            });
            break;
        }

        // 🏷️ Изменение участника (Никнейм, Таймаут, Мьюты)
        case AuditLogEvent.MemberUpdate: {
            if (!changes) break;

            // Изменение никнейма
            const nickChange = changes.find((c: any) => c.key === 'nick');
            if (nickChange) {
                const oldNick = (nickChange.old as string) || 'Без никнейма';
                const newNick = (nickChange.new as string) || 'Сброшен на стандартный';

                await sendAdminLog({
                    title: '🏷️ Изменение никнейма модератором',
                    description: `Никнейм участника <@${targetId}> был изменен.`,
                    color: '#3498db',
                    fields: [
                        { name: 'Старый ник', value: `\`${oldNick}\``, inline: true },
                        { name: 'Новый ник', value: `\`${newNick}\``, inline: true },
                        { name: 'Кто изменил', value: `${executorMention} (${executorTag})`, inline: false }
                    ],
                    executorId: executorId || executor?.id,
                });
            }

            // Выдача / снятие таймаута
            const timeoutChange = changes.find((c: any) => c.key === 'communication_disabled_until');
            if (timeoutChange) {
                const until = timeoutChange.new as string | undefined;
                const isMuted = until && new Date(until).getTime() > Date.now();

                await sendAdminLog({
                    title: isMuted ? '⏳ Выдача таймаута' : '🔊 Снятие таймаута',
                    description: isMuted
                        ? `Модератор ${executorMention} выдал таймаут участнику <@${targetId}>.`
                        : `Модератор ${executorMention} досрочно снял таймаут с участника <@${targetId}>.`,
                    color: isMuted ? '#f1c40f' : '#2ecc71',
                    fields: isMuted
                        ? [
                              { name: 'До', value: `<t:${Math.floor(new Date(until).getTime() / 1000)}:F>`, inline: true },
                              { name: '📝 Причина', value: `\`${reason || 'Не указана'}\``, inline: true }
                          ]
                        : [],
                    executorId: executorId || executor?.id,
                });
            }

            // Серверный мут в голосовых каналах
            const muteChange = changes.find((c: any) => c.key === 'mute');
            if (muteChange) {
                const isMuted = Boolean(muteChange.new);
                await sendAdminLog({
                    title: isMuted ? '🎙️ Мут в войсе' : '🎙️ Размут в войсе',
                    description: `Модератор ${executorMention} ${isMuted ? 'заглушил' : 'разглушил'} участника <@${targetId}> в голосовом канале.`,
                    color: isMuted ? '#e67e22' : '#2ecc71',
                    executorId: executorId || executor?.id,
                });
            }

            // Серверный деаф (глушение наушников)
            const deafChange = changes.find((c: any) => c.key === 'deaf');
            if (deafChange) {
                const isDeafened = Boolean(deafChange.new);
                await sendAdminLog({
                    title: isDeafened ? '🔇 Отключение звука участнику' : '🔊 Включение звука участнику',
                    description: `Модератор ${executorMention} ${isDeafened ? 'выключил звук' : 'включил звук'} участнику <@${targetId}>.`,
                    color: isDeafened ? '#e67e22' : '#2ecc71',
                    executorId: executorId || executor?.id,
                });
            }
            break;
        }

        // 🎭 Изменение ролей участника
        case AuditLogEvent.MemberRoleUpdate: {
            if (!changes) break;

            const addedRoles = changes.find((c: any) => c.key === '$add')?.new as Array<{ id: string; name: string }> | undefined;
            const removedRoles = changes.find((c: any) => c.key === '$remove')?.new as Array<{ id: string; name: string }> | undefined;

            const fields = [];
            if (addedRoles && addedRoles.length > 0) {
                fields.push({
                    name: '➕ Добавленные роли',
                    value: addedRoles.map((r) => `<@&${r.id}>`).join(', '),
                    inline: false,
                });
            }
            if (removedRoles && removedRoles.length > 0) {
                fields.push({
                    name: '➖ Снятые роли',
                    value: removedRoles.map((r) => `<@&${r.id}>`).join(', '),
                    inline: false,
                });
            }

            if (fields.length > 0) {
                await sendAdminLog({
                    title: '🎭 Изменение ролей участника',
                    description: `Модератор ${executorMention} изменил роли участнику <@${targetId}>.`,
                    color: '#9b59b6',
                    fields,
                    executorId: executorId || executor?.id,
                });
            }
            break;
        }

        // 🔀 Перемещение пользователя в голосовом канале
        case AuditLogEvent.MemberMove: {
            const channelChange = changes?.find((c: any) => c.key === 'channel_id');
            const targetChannelId = channelChange?.new as string | undefined;

            await sendAdminLog({
                title: '🔀 Перемещение в голосовом канале',
                description: `Модератор ${executorMention} переместил участника <@${targetId}> ${targetChannelId ? `в канал <#${targetChannelId}>` : ''}.`,
                color: '#34495e',
                executorId: executorId || executor?.id,
            });
            break;
        }

        // 🔌 Принудительное отключение от голосового канала
        case AuditLogEvent.MemberDisconnect: {
            await sendAdminLog({
                title: '🔌 Отключение от войса',
                description: `Модератор ${executorMention} отключил участника <@${targetId}> от голосового канала.`,
                color: '#e74c3c',
                executorId: executorId || executor?.id,
            });
            break;
        }

        // ==========================================
        // 💬 МОДЕРАЦИЯ ТЕКСТОВЫХ И ГОЛОСОВЫХ КАНАЛОВ
        // ==========================================

        // 🧹 Очистка чата (Bulk Delete)
        case AuditLogEvent.MessageBulkDelete: {
            const count = (extra as { count?: number })?.count ?? 'Неизвестно';

            await sendAdminLog({
                title: '🧹 Массовая очистка сообщений',
                description: `Модератор ${executorMention} очистил сообщения в канале <#${targetId}>.`,
                color: '#e67e22',
                fields: [{ name: 'Количество сообщений', value: `\`${count}\``, inline: true }],
                executorId: executorId || executor?.id,
            });
            break;
        }

        // 📌 Закрепление сообщения
        case AuditLogEvent.MessagePin: {
            await sendAdminLog({
                title: '📌 Закрепление сообщения',
                description: `Модератор ${executorMention} закрепил сообщение в канале <#${targetId}>.`,
                color: '#3498db',
                executorId: executorId || executor?.id,
            });
            break;
        }

        // 📍 Открепление сообщения
        case AuditLogEvent.MessageUnpin: {
            await sendAdminLog({
                title: '📍 Открепление сообщения',
                description: `Модератор ${executorMention} открепил сообщение в канале <#${targetId}>.`,
                color: '#95a5a6',
                executorId: executorId || executor?.id,
            });
            break;
        }

        // ✏️ Редактирование параметров канала
        case AuditLogEvent.ChannelUpdate: {
            if (!changes) break;
            const fields: { name: string; value: string; inline?: boolean }[] = [];

            const nameChange = changes.find((c: any) => c.key === 'name');
            const topicChange = changes.find((c: any) => c.key === 'topic');
            const nsfwChange = changes.find((c: any) => c.key === 'nsfw');
            const slowmodeChange = changes.find((c: any) => c.key === 'rate_limit_per_user');

            if (nameChange) fields.push({ name: 'Название', value: `\`${nameChange.old}\` ➔ \`${nameChange.new}\`` });
            if (topicChange) fields.push({ name: 'Тема канала', value: `\`${topicChange.old || 'Пусто'}\` ➔ \`${topicChange.new || 'Пусто'}\`` });
            if (nsfwChange) fields.push({ name: 'NSFW', value: `${nsfwChange.old ? 'Включен' : 'Выключен'} ➔ ${nsfwChange.new ? 'Включен' : 'Выключен'}` });
            if (slowmodeChange) fields.push({ name: 'Медленный режим', value: `\`${slowmodeChange.old}сек\` ➔ \`${slowmodeChange.new}сек\`` });

            if (fields.length > 0) {
                await sendAdminLog({
                    title: '🛠️ Изменение настроек канала',
                    description: `Модератор ${executorMention} изменил настройки канала <#${targetId}>.`,
                    color: '#f39c12',
                    fields,
                    executorId: executorId || executor?.id,
                });
            }
            break;
        }

        // ==========================================
        // 🛡️ УПРАВЛЕНИЕ РОЛЯМИ И ПРАВАМИ
        // ==========================================

        // ➕ Создание роли
        case AuditLogEvent.RoleCreate: {
            const roleName = (changes?.find((c: any) => c.key === 'name')?.new as string) || 'Новая роль';
            await sendAdminLog({
                title: '🛡️ Создание роли',
                description: `Модератор ${executorMention} создал роль <@&${targetId}> (\`${roleName}\`).`,
                color: '#2ecc71',
                executorId: executorId || executor?.id,
            });
            break;
        }

        // ➖ Удаление роли
        case AuditLogEvent.RoleDelete: {
            const oldName = (changes?.find((c: any) => c.key === 'name')?.old as string) || 'Удаленная роль';
            await sendAdminLog({
                title: '🗑️ Удаление роли',
                description: `Модератор ${executorMention} удалил роль \`${oldName}\` (ID: \`${targetId}\`).`,
                color: '#e74c3c',
                executorId: executorId || executor?.id,
            });
            break;
        }

        // ✏️ Изменение роли (права, название, цвет)
        case AuditLogEvent.RoleUpdate: {
            if (!changes) break;

            const nameChange = changes.find((c: any) => c.key === 'name');
            const permChange = changes.find((c: any) => c.key === 'permissions');
            const colorChange = changes.find((c: any) => c.key === 'color');

            const fields = [];
            if (nameChange) {
                fields.push({
                    name: 'Название роли',
                    value: `\`${nameChange.old}\` ➔ \`${nameChange.new}\``,
                    inline: false,
                });
            }
            if (colorChange) {
                fields.push({
                    name: 'Цвет роли',
                    value: `\`#${Number(colorChange.old).toString(16)}\` ➔ \`#${Number(colorChange.new).toString(16)}\``,
                    inline: false,
                });
            }
            if (permChange) {
                fields.push({
                    name: '⚠️ Изменение прав доступа',
                    value: `Права роли были отредактированы.`,
                    inline: false,
                });
            }

            await sendAdminLog({
                title: '🛠️ Изменение настроек роли',
                description: `Модератор ${executorMention} обновил роль <@&${targetId}>.`,
                color: '#f39c12',
                fields,
                executorId: executorId || executor?.id,
            });
            break;
        }

        // ==========================================
        // 📁 ИЗМЕНЕНИЕ СТРУКТУРЫ СЕРВЕРА
        // ==========================================

        // 📁 Создание канала или категории
        case AuditLogEvent.ChannelCreate: {
            const channelName = (changes?.find((c: any) => c.key === 'name')?.new as string) || 'канал';
            await sendAdminLog({
                title: '📁 Создание канала',
                description: `Модератор ${executorMention} создал канал <#${targetId}> (\`${channelName}\`).`,
                color: '#2ecc71',
                executorId: executorId || executor?.id,
            });
            break;
        }

        // 🗑️ Удаление канала или категории
        case AuditLogEvent.ChannelDelete: {
            const oldName = (changes?.find((c: any) => c.key === 'name')?.old as string) || 'неизвестно';
            await sendAdminLog({
                title: '🗑️ Удаление канала',
                description: `Модератор ${executorMention} удалил канал \`#${oldName}\` (ID: \`${targetId}\`).`,
                color: '#e74c3c',
                executorId: executorId || executor?.id,
            });
            break;
        }

        // 🔒 Создание/изменение/удаление локальных прав канала (Overwrites)
        case AuditLogEvent.ChannelOverwriteCreate:
        case AuditLogEvent.ChannelOverwriteUpdate:
        case AuditLogEvent.ChannelOverwriteDelete: {
            await sendAdminLog({
                title: '🔒 Изменение прав доступа к каналу',
                description: `Модератор ${executorMention} изменил разрешения (Overwrites) в канале <#${targetId}>.`,
                color: '#e67e22',
                executorId: executorId || executor?.id,
            });
            break;
        }

        // ==========================================
        // 🌐 ВЕБХУКИ И ИНТЕГРАЦИИ
        // ==========================================

        case AuditLogEvent.WebhookCreate: {
            const name = (changes?.find((c: any) => c.key === 'name')?.new as string) || 'вебхук';
            await sendAdminLog({
                title: '🔗 Создание вебхука',
                description: `Модератор ${executorMention} создал вебхук \`${name}\` (ID: \`${targetId}\`).`,
                color: '#2ecc71',
                executorId: executorId || executor?.id,
            });
            break;
        }

        case AuditLogEvent.WebhookUpdate: {
            await sendAdminLog({
                title: '🔗 Редактирование вебхука',
                description: `Модератор ${executorMention} изменил настройки вебхука (ID: \`${targetId}\`).`,
                color: '#f1c40f',
                executorId: executorId || executor?.id,
            });
            break;
        }

        case AuditLogEvent.WebhookDelete: {
            await sendAdminLog({
                title: '🔗 Удаление вебхука',
                description: `Модератор ${executorMention} удалил вебхук (ID: \`${targetId}\`).`,
                color: '#e74c3c',
                executorId: executorId || executor?.id,
            });
            break;
        }

        // ==========================================
        // 📅 МЕРОПРИЯТИЯ (SCHEDULED EVENTS)
        // ==========================================

        case AuditLogEvent.GuildScheduledEventCreate: {
            const name = (changes?.find((c: any) => c.key === 'name')?.new as string) || 'Событие';
            await sendAdminLog({
                title: '📅 Создание события',
                description: `Модератор ${executorMention} создал мероприятие \`${name}\`.`,
                color: '#2ecc71',
                executorId: executorId || executor?.id,
            });
            break;
        }

        case AuditLogEvent.GuildScheduledEventUpdate: {
            await sendAdminLog({
                title: '📅 Обновление события',
                description: `Модератор ${executorMention} обновил детали мероприятия (ID: \`${targetId}\`).`,
                color: '#f1c40f',
                executorId: executorId || executor?.id,
            });
            break;
        }

        case AuditLogEvent.GuildScheduledEventDelete: {
            await sendAdminLog({
                title: '📅 Отмена события',
                description: `Модератор ${executorMention} отменил мероприятие (ID: \`${targetId}\`).`,
                color: '#e74c3c',
                executorId: executorId || executor?.id,
            });
            break;
        }

        // ==========================================
        // 🤖 ПРАВИЛА АВТОМОДЕРАЦИИ (AUTOMOD)
        // ==========================================

        case AuditLogEvent.AutoModerationRuleCreate: {
            const name = (changes?.find((c: any) => c.key === 'name')?.new as string) || 'Правило';
            await sendAdminLog({
                title: '🤖 Создание правила AutoMod',
                description: `Модератор ${executorMention} создал правило автоматической модерации \`${name}\`.`,
                color: '#2ecc71',
                executorId: executorId || executor?.id,
            });
            break;
        }

        case AuditLogEvent.AutoModerationRuleUpdate: {
            await sendAdminLog({
                title: '🤖 Изменение правила AutoMod',
                description: `Модератор ${executorMention} обновил правило AutoMod (ID: \`${targetId}\`).`,
                color: '#f1c40f',
                executorId: executorId || executor?.id,
            });
            break;
        }

        case AuditLogEvent.AutoModerationRuleDelete: {
            await sendAdminLog({
                title: '🤖 Удаление правила AutoMod',
                description: `Модератор ${executorMention} удалил правило AutoMod (ID: \`${targetId}\`).`,
                color: '#e74c3c',
                executorId: executorId || executor?.id,
            });
            break;
        }

        // ==========================================
        // 📜 ПРИГЛАШЕНИЯ, ЭМОДЗИ И СТИКЕРЫ
        // ==========================================

        // ✉️ Создание приглашения
        case AuditLogEvent.InviteCreate: {
            const code = changes?.find((c: any) => c.key === 'code')?.new as string;
            await sendAdminLog({
                title: '✉️ Создание приглашения',
                description: `Модератор ${executorMention} создал инвайт \`${code || targetId}\`.`,
                color: '#1abc9c',
                executorId: executorId || executor?.id,
            });
            break;
        }

        // ❌ Удаление приглашения
        case AuditLogEvent.InviteDelete: {
            const code = changes?.find((c: any) => c.key === 'code')?.old as string;
            await sendAdminLog({
                title: '❌ Удаление приглашения',
                description: `Модератор ${executorMention} отозвал инвайт \`${code || targetId}\`.`,
                color: '#95a5a6',
                executorId: executorId || executor?.id,
            });
            break;
        }

        // 😀 Добавление эмодзи
        case AuditLogEvent.EmojiCreate: {
            const name = (changes?.find((c: any) => c.key === 'name')?.new as string) || 'эмодзи';
            await sendAdminLog({
                title: '😀 Добавление эмодзи',
                description: `Модератор ${executorMention} добавил эмодзи \`:${name}:\`.`,
                color: '#2ecc71',
                executorId: executorId || executor?.id,
            });
            break;
        }

        // ✏️ Обновление эмодзи
        case AuditLogEvent.EmojiUpdate: {
            const oldName = (changes?.find((c: any) => c.key === 'name')?.old as string) || 'эмодзи';
            const newName = (changes?.find((c: any) => c.key === 'name')?.new as string) || 'эмодзи';
            await sendAdminLog({
                title: '✏️ Переименование эмодзи',
                description: `Модератор ${executorMention} переименовал эмодзи с \`:${oldName}:\` на \`:${newName}:\`.`,
                color: '#f1c40f',
                executorId: executorId || executor?.id,
            });
            break;
        }

        // 🗑️ Удаление эмодзи
        case AuditLogEvent.EmojiDelete: {
            const name = (changes?.find((c: any) => c.key === 'name')?.old as string) || 'эмодзи';
            await sendAdminLog({
                title: '🗑️ Удаление эмодзи',
                description: `Модератор ${executorMention} удалил эмодзи \`:${name}:\`.`,
                color: '#e74c3c',
                executorId: executorId || executor?.id,
            });
            break;
        }

        // 🎨 Добавление стикера
        case AuditLogEvent.StickerCreate: {
            const name = (changes?.find((c: any) => c.key === 'name')?.new as string) || 'стикер';
            await sendAdminLog({
                title: '🎨 Добавление стикера',
                description: `Модератор ${executorMention} добавил стикер \`${name}\`.`,
                color: '#2ecc71',
                executorId: executorId || executor?.id,
            });
            break;
        }

        // ✏️ Редактирование стикера
        case AuditLogEvent.StickerUpdate: {
            await sendAdminLog({
                title: '✏️ Обновление стикера',
                description: `Модератор ${executorMention} обновил информацию о стикере (ID: \`${targetId}\`).`,
                color: '#f1c40f',
                executorId: executorId || executor?.id,
            });
            break;
        }

        // 🗑️ Удаление стикера
        case AuditLogEvent.StickerDelete: {
            const name = (changes?.find((c: any) => c.key === 'name')?.old as string) || 'стикер';
            await sendAdminLog({
                title: '🗑️ Удаление стикера',
                description: `Модератор ${executorMention} удалил стикер \`${name}\`.`,
                color: '#e74c3c',
                executorId: executorId || executor?.id,
            });
            break;
        }
    }
};

export default handler;