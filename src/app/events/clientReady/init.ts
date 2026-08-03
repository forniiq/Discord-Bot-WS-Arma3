import { startBankAutoSync } from '@/services/bank.service';
import { StartMonitorUpdater } from '@/services/monitor-updater.service';
import { refreshUnitsCache } from '@/services/units.service';
import { startZbdChecker } from '@/services/zbd-checker.service';
import { initLogger } from '@/utils/logger.utils';
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