import type {
    Guild,
    GuildMember,
} from 'discord.js';

import {
    DECREE_ISSUERS,
} from '@/config/decree-categories';

const issuerMembers = new Map<string, GuildMember>();

const issuerRoleIds = new Set(
    DECREE_ISSUERS.map(issuer => issuer.roleId)
);


// ============================================================
// Добавить участника в кэш
// ============================================================

function cacheMember(member: GuildMember) {
    for (const roleId of issuerRoleIds) {
        if (member.roles.cache.has(roleId)) {
            issuerMembers.set(roleId, member);
        }
    }
}


// ============================================================
// Удалить участника из кэша
// ============================================================

function removeMember(memberId: string) {
    for (const [roleId, member] of issuerMembers) {
        if (member.id === memberId) {
            issuerMembers.delete(roleId);
        }
    }
}


// ============================================================
// Полная синхронизация
// Вызывается один раз при запуске бота
// ============================================================

export async function initializeIssuerCache(
    guild: Guild
) {
    const members =
        await guild.members.fetch();

    for (const member of members.values()) {
        cacheMember(member);
    }

    console.log(
        `[IssuerCache] Загружено должностей: ${issuerMembers.size}`
    );
}


// ============================================================
// Обновление участника
// ============================================================

export function updateIssuerMember(
    member: GuildMember
) {
    removeMember(member.id);
    cacheMember(member);
}


// ============================================================
// Удаление участника
// ============================================================

export function removeIssuerMember(
    memberId: string
) {
    removeMember(memberId);
}


// ============================================================
// Получить текущего обладателя должности
// ============================================================

export function getIssuerMember(
    roleId: string
): GuildMember | null {
    return issuerMembers.get(roleId) ?? null;
}