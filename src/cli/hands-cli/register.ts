/**
 * Hands CLI registration
 *
 * Registers the `openclaw hands` subcommand family:
 *   - hands run    — Start the Hands Worker (foreground, long-running)
 *   - hands status — Show worker connection status
 */

import type { Command } from "commander";
import { createToolExecutor } from "../../hands/skills/index.js";
import { HandsWorker } from "../../hands/worker.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import { defaultRuntime } from "../../runtime.js";
import { loadConfig } from "../../shared/config/config.js";

const handsLog = createSubsystemLogger("hands");

export function registerHandsCli(program: Command) {
  const hands = program.command("hands").description("Hands Worker process");

  hands
    .command("run")
    .description("Start the Hands Worker (connects to Brain gateway)")
    .option("--brain-url <url>", "Brain Gateway WebSocket URL")
    .option("--secret <secret>", "Worker shared secret")
    .option("--cwd <dir>", "Working directory for file/shell tools")
    .option("--heartbeat <seconds>", "Heartbeat interval in seconds", "30")
    .option("--verbose", "Verbose logging", false)
    .action(async (opts: HandsRunOpts) => {
      await runHandsWorker(opts);
    });

  hands
    .command("status")
    .description("Show Hands Worker configuration")
    .action(async () => {
      const config = await loadConfig();
      const handsConfig = config.hands;
      if (!handsConfig?.enabled) {
        defaultRuntime.error("Hands mode is not enabled in config.");
        defaultRuntime.error("Run: openclaw config set hands.enabled true");
        return;
      }
      console.log("Hands configuration:");
      console.log(`  enabled:            ${handsConfig.enabled}`);
      console.log(`  brainUrl:           ${handsConfig.brainUrl ?? "(not set)"}`);
      console.log(`  workerSecret:       ${handsConfig.workerSecret ? "***" : "(not set)"}`);
      console.log(`  heartbeatInterval:  ${handsConfig.heartbeatInterval ?? 30}s`);
      console.log(`  taskTimeout:        ${handsConfig.taskTimeout ?? 300}s`);
    });
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type HandsRunOpts = {
  brainUrl?: string;
  secret?: string;
  cwd?: string;
  heartbeat?: string;
  verbose?: boolean;
};

// ---------------------------------------------------------------------------
// Run handler
// ---------------------------------------------------------------------------

async function runHandsWorker(opts: HandsRunOpts) {
  const config = await loadConfig();
  const handsConfig = config.hands ?? {};

  // Resolve options: CLI flags > env vars > config file
  const brainUrl = opts.brainUrl ?? process.env.OPENCLAW_HANDS_BRAIN_URL ?? handsConfig.brainUrl;

  const secret =
    opts.secret ?? process.env.OPENCLAW_HANDS_WORKER_SECRET ?? handsConfig.workerSecret;

  if (!brainUrl) {
    defaultRuntime.error(
      "Brain URL required. Set --brain-url, OPENCLAW_HANDS_BRAIN_URL, or config hands.brainUrl",
    );
    defaultRuntime.exit(1);
    return;
  }

  if (!secret) {
    defaultRuntime.error(
      "Worker secret required. Set --secret, OPENCLAW_HANDS_WORKER_SECRET, or config hands.workerSecret",
    );
    defaultRuntime.exit(1);
    return;
  }

  const heartbeatInterval = Number.parseInt(opts.heartbeat ?? "30", 10);
  const cwd = opts.cwd ?? process.cwd();

  handsLog.info(`Starting Hands Worker`);
  handsLog.info(`  Brain URL:      ${brainUrl}`);
  handsLog.info(`  Working dir:    ${cwd}`);
  handsLog.info(`  Heartbeat:      ${heartbeatInterval}s`);

  const toolExecutor = createToolExecutor({ cwd });

  const worker = new HandsWorker({
    brainUrl,
    secret,
    heartbeatInterval,
    toolExecutor,
  });

  // Wire worker events to logger
  worker.on("connected", () => {
    handsLog.info("Connected to Brain gateway");
  });

  worker.on("disconnected", ({ code, reason }: { code: number; reason: string }) => {
    handsLog.warn(`Disconnected from Brain (code=${code}, reason=${reason})`);
  });

  worker.on("reconnecting", ({ attempt, delay }: { attempt: number; delay: number }) => {
    handsLog.info(`Reconnecting... attempt ${attempt} (delay ${delay}ms)`);
  });

  worker.on("maxReconnectAttemptsReached", () => {
    handsLog.error("Max reconnection attempts reached. Exiting.");
    defaultRuntime.exit(1);
  });

  worker.on("authFailed", () => {
    handsLog.error("Authentication failed. Check your worker secret.");
    defaultRuntime.exit(1);
  });

  worker.on("error", (err: Error) => {
    handsLog.error(`Worker error: ${err.message}`);
  });

  worker.on("taskStart", ({ taskId, tool }: { taskId: string; tool: string }) => {
    handsLog.info(`Task ${taskId}: executing tool "${tool}"`);
  });

  worker.on(
    "taskEnd",
    ({ taskId, tool, status }: { taskId: string; tool: string; status: string }) => {
      handsLog.info(`Task ${taskId}: tool "${tool}" → ${status}`);
    },
  );

  // Graceful shutdown
  const shutdown = () => {
    handsLog.info("Shutting down Hands Worker...");
    worker.stop();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  // Start the worker
  worker.start();

  // Keep the process alive
  await new Promise(() => {
    // Intentionally never resolves — the process runs until stopped
  });
}
