import type { CliDeps } from "../cli/deps.js";
import { resolveDefaultAgentId } from "../brain/agent-runner/agent-scope.js";
import { loadConfig } from "../shared/config/config.js";
import { resolveAgentMainSessionKey } from "../shared/config/sessions.js";
import { runCronIsolatedAgentTurn } from "../brain/cron/isolated-agent.js";
import { appendCronRunLog, resolveCronRunLogPath } from "../brain/cron/run-log.js";
import { CronService } from "../brain/cron/service.js";
import { resolveCronStorePath } from "../brain/cron/store.js";
import { runHeartbeatOnce } from "../infra/heartbeat-runner.js";
import { requestHeartbeatNow } from "../infra/heartbeat-wake.js";
import { enqueueSystemEvent } from "../infra/system-events.js";
import { getChildLogger } from "../logging.js";
import { normalizeAgentId } from "../shared/routing/session-key.js";
import { defaultRuntime } from "../runtime.js";
import { createBriefingJobDefs } from "../brain/cron/briefing-runner.js";

export type GatewayCronState = {
  cron: CronService;
  storePath: string;
  cronEnabled: boolean;
};

export function buildGatewayCronService(params: {
  cfg: ReturnType<typeof loadConfig>;
  deps: CliDeps;
  broadcast: (event: string, payload: unknown, opts?: { dropIfSlow?: boolean }) => void;
}): GatewayCronState {
  const cronLogger = getChildLogger({ module: "cron" });
  const storePath = resolveCronStorePath(params.cfg.cron?.store);
  const cronEnabled = process.env.OPENCLAW_SKIP_CRON !== "1" && params.cfg.cron?.enabled !== false;

  const resolveCronAgent = (requested?: string | null) => {
    const runtimeConfig = loadConfig();
    const normalized =
      typeof requested === "string" && requested.trim() ? normalizeAgentId(requested) : undefined;
    const hasAgent =
      normalized !== undefined &&
      Array.isArray(runtimeConfig.agents?.list) &&
      runtimeConfig.agents.list.some(
        (entry) =>
          entry && typeof entry.id === "string" && normalizeAgentId(entry.id) === normalized,
      );
    const agentId = hasAgent ? normalized : resolveDefaultAgentId(runtimeConfig);
    return { agentId, cfg: runtimeConfig };
  };

  const cron = new CronService({
    storePath,
    cronEnabled,
    enqueueSystemEvent: (text, opts) => {
      const { agentId, cfg: runtimeConfig } = resolveCronAgent(opts?.agentId);
      const sessionKey = resolveAgentMainSessionKey({
        cfg: runtimeConfig,
        agentId,
      });
      enqueueSystemEvent(text, { sessionKey });
    },
    requestHeartbeatNow,
    runHeartbeatOnce: async (opts) => {
      const runtimeConfig = loadConfig();
      return await runHeartbeatOnce({
        cfg: runtimeConfig,
        reason: opts?.reason,
        deps: { ...params.deps, runtime: defaultRuntime },
      });
    },
    runIsolatedAgentJob: async ({ job, message }) => {
      const { agentId, cfg: runtimeConfig } = resolveCronAgent(job.agentId);
      return await runCronIsolatedAgentTurn({
        cfg: runtimeConfig,
        deps: params.deps,
        job,
        message,
        agentId,
        sessionKey: `cron:${job.id}`,
        lane: "cron",
      });
    },
    log: getChildLogger({ module: "cron", storePath }),
    onEvent: (evt) => {
      params.broadcast("cron", evt, { dropIfSlow: true });
      if (evt.action === "finished") {
        const logPath = resolveCronRunLogPath({
          storePath,
          jobId: evt.jobId,
        });
        void appendCronRunLog(logPath, {
          ts: Date.now(),
          jobId: evt.jobId,
          action: "finished",
          status: evt.status,
          error: evt.error,
          summary: evt.summary,
          sessionId: evt.sessionId,
          sessionKey: evt.sessionKey,
          runAtMs: evt.runAtMs,
          durationMs: evt.durationMs,
          nextRunAtMs: evt.nextRunAtMs,
        }).catch((err) => {
          cronLogger.warn({ err: String(err), logPath }, "cron: run log append failed");
        });
      }
    },
  });

  return { cron, storePath, cronEnabled };
}

export async function seedCronJobsIfEmpty(cron: CronService) {
  const logger = getChildLogger({ module: "cron", meta: { task: "seed" } });
  try {
    const existing = await cron.list({ includeDisabled: true });
    if (existing.length > 0) {
      logger.debug(`Found ${existing.length} existing cron jobs in store. Skipping auto-seed.`);
      return; // Already seeded
    }

    logger.info("Initializing empty cron store with default Intelligence loops...");
    const tz = "UTC";

    // 1. Briefings (Morning, Midday, Evening)
    const briefings = createBriefingJobDefs(tz);
    for (const b of briefings) {
      await cron.add(b);
    }

    // 2. Synthesis Runner (Every 8 hours)
    await cron.add({
      name: "synthesis-runner",
      enabled: true,
      description: "Generates the Master Synthesis and Operator Profile every 8 hours.",
      schedule: { kind: "cron", expr: "0 */8 * * *", tz },
      sessionTarget: "isolated",
      wakeMode: "now",
      delivery: { mode: "none" },
      payload: {
        kind: "agentTurn",
        message:
          "Run a full synthesis cycle. Synthesize the Master Synthesis context along with the operator profile, so it's fresh for the next session.",
        deliver: false,
      },
    });

    // 3. Expression Evaluator (Every 45 minutes)
    await cron.add({
      name: "expression-evaluator",
      enabled: true,
      description: "Evaluates triggers for spontaneous expression every 45 minutes.",
      schedule: { kind: "cron", expr: "*/45 * * * *", tz },
      sessionTarget: "isolated",
      wakeMode: "now",
      delivery: { mode: "announce" },
      payload: {
        kind: "agentTurn",
        message:
          "Check the expression engine. If there is a highly significant convergence of cosmic data, hypotheses, or patterns across Council systems, compose a spontaneous message to the operator. If nothing meets the threshold, output nothing.",
        deliver: true,
      },
    });

    // 4. Observer Cycle (Every 6 hours)
    await cron.add({
      name: "observer-cycle",
      enabled: true,
      description: "Runs the cyclical pattern Observer every 6 hours.",
      schedule: { kind: "cron", expr: "0 */6 * * *", tz },
      sessionTarget: "isolated",
      wakeMode: "now",
      delivery: { mode: "none" },
      payload: {
        kind: "agentTurn",
        message:
          "Execute the Observer pattern detection across recent episodic memories and cosmic weather. Update semantic memory with any newly detected correlations or hypotheses.",
        deliver: false,
      },
    });

    logger.info("Successfully seeded intelligence cron jobs.");
  } catch (err) {
    logger.warn(`Failed to auto-seed cron jobs: ${err instanceof Error ? err.message : String(err)}`);
  }
}
