import { initializeIssuerCache, updateIssuerMember } from '@/services/issuer-cache.service';
import type { EventHandler } from 'commandkit';


const handler: EventHandler<'guildMemberUpdate'> = async (_oldMember, newMember: any) => {
    updateIssuerMember(newMember);
};

export default handler;