import { setupAdminLogging } from '@/services/adminLogger';
import { startBankAutoSync } from '@/services/bankService';
import { StartMonitorUpdater } from '@/services/monitorUpdater';
import { refreshUnitsCache } from '@/services/unitsService';
import { startZbdChecker } from '@/services/zbdChecker';
import { initLogger } from '@/utils/logger';
import type { EventHandler } from 'commandkit';
import { Logger } from 'commandkit/logger';


const handler: EventHandler<'clientReady'> = async (client: any) => {
  Logger.info(`===== Logged in as ${client.user.username}! =====`);

  initLogger(client);
  StartMonitorUpdater(client);
  startZbdChecker(client, false);
  startBankAutoSync(client, 60_000);
  await refreshUnitsCache();
};

export default handler;