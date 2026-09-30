import { updateIssuerMember } from '@/services/issuer-cache.service';
import type { EventHandler } from 'commandkit';


const handler: EventHandler<'guildMemberAdd'> = async (member: any) => {
    updateIssuerMember(member);
};

export default handler;