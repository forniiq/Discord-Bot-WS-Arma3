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

function cacheMember(member: GuildMember) {
    for (const roleId of issuerRoleIds) {
        if (member.roles.cache.has(roleId)) {
            issuerMembers.set(roleId, member);
        }
    }
}

function removeMember(memberId: string) {
    for (const [roleId, member] of issuerMembers) {
        if (member.id === memberId) {
            issuerMembers.delete(roleId);
        }
    }
}

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

export function updateIssuerMember(
    member: GuildMember
) {
    removeMember(member.id);
    cacheMember(member);
}

export function removeIssuerMember(
    memberId: string
) {
    removeMember(memberId);
}

export function getIssuerMember(
    roleId: string
): GuildMember | null {
    return issuerMembers.get(roleId) ?? null;
}