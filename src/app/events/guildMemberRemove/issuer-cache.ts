import { removeIssuerMember } from '@/services/issuer-cache.service';
import type { EventHandler } from 'commandkit';


const handler: EventHandler<'guildMemberRemove'> = async (member: any) => {
    removeIssuerMember(member.id)
};

export default handler;