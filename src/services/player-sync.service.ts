import { GuildMember } from 'discord.js';
import { PlayerInfo } from '@/database/queries';
import { ROLES_CONFIG } from '@/config/roles-сonfig';
import { parseArmaArray } from '@/utils/array-parser.utils';
import { sendLog } from '@/utils/logger.utils';

export async function syncPlayerProfile(
    guild: any, 
    player: PlayerInfo, 
    cachedMember?: GuildMember | null
): Promise<{ roleSuccess: boolean; nameSuccess: boolean }> {
    let roleSuccess = false;
    let nameSuccess = false;

    if (!player.DiscID) {
        return { roleSuccess: false, nameSuccess: false };
    }

    const member: GuildMember | null = cachedMember 
        ?? guild.members.cache.get(player.DiscID) 
        ?? null;

    if (!member) {
        return { roleSuccess: false, nameSuccess: false };
    }

    const targetRoleIds = new Set<string>();

    const unitConfig = ROLES_CONFIG.units[player.pUnits];
    if (unitConfig && unitConfig.roleId) {
        targetRoleIds.add(unitConfig.roleId);
        if (ROLES_CONFIG.categoryUnitsRoleId) {
            targetRoleIds.add(ROLES_CONFIG.categoryUnitsRoleId);
        }
    }

    const rankIndex = parseInt(player.pLvl, 10);
    if (!isNaN(rankIndex) && ROLES_CONFIG.ranks[rankIndex]) {
        const rankRoleId = ROLES_CONFIG.ranks[rankIndex];
        if (rankRoleId) targetRoleIds.add(rankRoleId);

        for (const cat of Object.values(ROLES_CONFIG.rankCategories)) {
            if (cat.rankIndexes.includes(rankIndex) && cat.categoryRoleId) {
                targetRoleIds.add(cat.categoryRoleId);
            }
        }
    }

    const vvsFlags = parseArmaArray(player.pCYP);
    const btvFlags = parseArmaArray(player.pBTV);
    let hasAnyPermission = false;

    vvsFlags.forEach((val, idx) => {
        if (val === 1 && ROLES_CONFIG.vvs[idx]) {
            targetRoleIds.add(ROLES_CONFIG.vvs[idx]!);
            hasAnyPermission = true;
        }
    });

    btvFlags.forEach((val, idx) => {
        if (val === 1 && ROLES_CONFIG.btv[idx]) {
            targetRoleIds.add(ROLES_CONFIG.btv[idx]!);
            hasAnyPermission = true;
        }
    });

    if (hasAnyPermission && ROLES_CONFIG.categoryPermissionsRoleId) {
        targetRoleIds.add(ROLES_CONFIG.categoryPermissionsRoleId);
    }

    const rpFlags = parseArmaArray(player.pRP);
    let hasAnySide = false;

    rpFlags.forEach((val, idx) => {
        if (val === 1 && ROLES_CONFIG.rp[idx]) {
            targetRoleIds.add(ROLES_CONFIG.rp[idx]!);
            hasAnySide = true;
        }
    });

    if (hasAnySide && ROLES_CONFIG.categorySidesRoleId) {
        targetRoleIds.add(ROLES_CONFIG.categorySidesRoleId);
    }

    const kmbFlags = parseArmaArray(player.pKMB);
    let hasAnyInstructor = false;

    kmbFlags.forEach((val, idx) => {
        if (val === 1 && ROLES_CONFIG.kmb[idx]) {
            targetRoleIds.add(ROLES_CONFIG.kmb[idx]!);
            hasAnyInstructor = true;
        }
    });

    if (hasAnyInstructor && ROLES_CONFIG.categoryInstructorsRoleId) {
        targetRoleIds.add(ROLES_CONFIG.categoryInstructorsRoleId);
    }

    const courseFlags = parseArmaArray(player.pSkill);
    let hasAnyCourse = false;

    courseFlags.forEach((val, idx) => {
        if (val === 1 && ROLES_CONFIG.courses[idx]) {
            targetRoleIds.add(ROLES_CONFIG.courses[idx]!);
            hasAnyCourse = true;
        }
    });

    if (hasAnyCourse && ROLES_CONFIG.categoryCoursesRoleId) {
        targetRoleIds.add(ROLES_CONFIG.categoryCoursesRoleId);
    }

    try {
        const allManagedRoles = new Set<string>();
        Object.values(ROLES_CONFIG.units).forEach(u => u.roleId && allManagedRoles.add(u.roleId));
        if (ROLES_CONFIG.categoryUnitsRoleId) allManagedRoles.add(ROLES_CONFIG.categoryUnitsRoleId);
        ROLES_CONFIG.ranks.forEach(r => r && allManagedRoles.add(r));
        Object.values(ROLES_CONFIG.rankCategories).forEach(c => c.categoryRoleId && allManagedRoles.add(c.categoryRoleId));
        ROLES_CONFIG.vvs.forEach(r => r && allManagedRoles.add(r));
        ROLES_CONFIG.btv.forEach(r => r && allManagedRoles.add(r));
        if (ROLES_CONFIG.categoryPermissionsRoleId) allManagedRoles.add(ROLES_CONFIG.categoryPermissionsRoleId);
        ROLES_CONFIG.rp.forEach(r => r && allManagedRoles.add(r));
        if (ROLES_CONFIG.categorySidesRoleId) allManagedRoles.add(ROLES_CONFIG.categorySidesRoleId);
        ROLES_CONFIG.kmb.forEach(r => r && allManagedRoles.add(r));
        if (ROLES_CONFIG.categoryInstructorsRoleId) allManagedRoles.add(ROLES_CONFIG.categoryInstructorsRoleId);
        ROLES_CONFIG.courses.forEach(r => r && allManagedRoles.add(r));
        if (ROLES_CONFIG.categoryCoursesRoleId) allManagedRoles.add(ROLES_CONFIG.categoryCoursesRoleId);

        const currentRoleIds = member.roles.cache.map(r => r.id);
        const userOtherRoleIds = currentRoleIds.filter(id => !allManagedRoles.has(id));

        const finalRoleSet = new Set([...userOtherRoleIds, ...Array.from(targetRoleIds)]);

        const hasRoleChanges = currentRoleIds.length !== finalRoleSet.size || 
            currentRoleIds.some(id => !finalRoleSet.has(id));

        if (hasRoleChanges) {
            await member.roles.set(Array.from(finalRoleSet));
        }
        
        roleSuccess = true;
    } catch (err) {
        await sendLog('ERROR', 'SyncService', `Ошибка при обновлении ролей ${player.pName} (${member.id}): ${err}`);
    }

    try {
        const cleanName = player.pName.replace(/^\[.*?\]\s*/, '').trim();

        let targetNickname = cleanName;
        if (unitConfig && unitConfig.tag) {
            const rawTag = unitConfig.tag.replace(/^\[+|\]+$/g, '').trim();
            targetNickname = `[${rawTag}] ${cleanName}`;
        }

        if (targetNickname.length > 32) {
            targetNickname = targetNickname.substring(0, 32);
        }

        if (member.manageable) {
            const currentName = member.nickname ?? member.user.username;

            if (currentName !== targetNickname) {
                await member.setNickname(targetNickname);
            }
            nameSuccess = true;
        } else {
            await sendLog('WARN', 'SyncService', `Не удалось изменить никнейм ${member.user.tag} (недостаточно прав бота или это владелец сервера)`);
        }
    } catch (err) {
        await sendLog('ERROR', 'SyncService', `Ошибка при установке никнейма в Discord для ${player.pName}: ${err}`);
    }

    return { roleSuccess, nameSuccess };
}