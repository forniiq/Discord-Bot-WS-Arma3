import { StartMonitorUpdater } from '@/services/monitorUpdater';
import { initLogger } from '@/utils/logger';
import type { EventHandler } from 'commandkit';
import { Logger } from 'commandkit/logger';


const handler: EventHandler<'clientReady'> = async (client: any) => {
  Logger.info(`Logged in as ${client.user.username}!`);
  initLogger(client);
  StartMonitorUpdater(client);
};

export default handler;
