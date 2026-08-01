import { setupAdminLogging } from '@/services/adminLogger';
import { StartMonitorUpdater } from '@/services/monitorUpdater';
import { startZbdChecker } from '@/services/zbdChecker';
import { initLogger } from '@/utils/logger';
import type { EventHandler } from 'commandkit';
import { Logger } from 'commandkit/logger';


const handler: EventHandler<'clientReady'> = async (client: any) => {
  Logger.info(`Logged in as ${client.user.username}!`);
  initLogger(client);
  StartMonitorUpdater(client);
  startZbdChecker(client, false);
};

export default handler;
