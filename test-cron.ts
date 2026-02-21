import { CronService } from "./src/brain/cron/service.js";
import { resolveCronStorePath } from "./src/brain/cron/store.js";
import { seedCronJobsIfEmpty } from "./src/gateway/server-cron.js";
import { getChildLogger } from "./src/logging.js";

async function run() {
  const storePath = resolveCronStorePath();
  console.log("RESOLVED STORE PATH:", storePath);
  
  const cron = new CronService({
    log: getChildLogger({ module: "test-cron" }),
    nowMs: Date.now,
    storePath,
    onCronEvent: () => {},
    cronEnabled: true,
  });
  
  try {
    const existing = await cron.list({ includeDisabled: true });
    console.log("EXISTING JOBS COUNT:", existing.length);
    if (existing.length === 0) {
      console.log("ATTEMPTING SEED...");
      await seedCronJobsIfEmpty(cron);
      console.log("SEED COMPLETE!");
    } else {
      console.log("JOBS ALREADY EXIST. NO SEED.");
    }
  } catch (err) {
    console.error("FATAL SEED ERROR:");
    console.error(err);
  }
}
run();
