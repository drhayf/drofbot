import path from "node:path";
import type { CanvasHostServer } from "../canvas-host/server.js";
import type { PluginServicesHandle } from "../plugins/services.js";
import type { RuntimeEnv } from "../runtime.js";
import type { ControlUiRootState } from "./control-ui.js";
import type { startBrowserControlServerIfEnabled } from "./server-browser.js";
import {
  resolveAgentWorkspaceDir,
  resolveDefaultAgentId,
} from "../brain/agent-runner/agent-scope.js";
import { registerSkillsChangeListener } from "../brain/agent-runner/skills/refresh.js";
import { initSubagentRegistry } from "../brain/agent-runner/subagent-registry.js";
import { startConsolidationRunner } from "../brain/cron/consolidation.js";
import { type ChannelId, listChannelPlugins } from "../channels/shared/plugins/index.js";
import { formatCliCommand } from "../cli/command-format.js";
import { createDefaultDeps } from "../cli/deps.js";
import { clearAgentRunContext, onAgentEvent } from "../infra/agent-events.js";
import {
  ensureControlUiAssetsBuilt,
  resolveControlUiRootOverrideSync,
  resolveControlUiRootSync,
} from "../infra/control-ui-assets.js";
import { isDiagnosticsEnabled } from "../infra/diagnostic-events.js";
import { logAcceptedEnvOption } from "../infra/env.js";
import { createExecApprovalForwarder } from "../infra/exec-approval-forwarder.js";
import { onHeartbeatEvent } from "../infra/heartbeat-events.js";
import { startHeartbeatRunner } from "../infra/heartbeat-runner.js";
import { getMachineDisplayName } from "../infra/machine-name.js";
import { ensureOpenClawCliOnPath } from "../infra/path-env.js";
import { setGatewaySigusr1RestartPolicy } from "../infra/restart.js";
import {
  primeRemoteSkillsCache,
  refreshRemoteBinsForConnectedNodes,
  setSkillsRemoteRegistry,
} from "../infra/skills-remote.js";
import { scheduleGatewayUpdateCheck } from "../infra/update-startup.js";
import { startDiagnosticHeartbeat, stopDiagnosticHeartbeat } from "../logging/diagnostic.js";
import { createSubsystemLogger, runtimeForLogger } from "../logging/subsystem.js";
import {
  CONFIG_PATH,
  isNixMode,
  loadConfig,
  migrateLegacyConfig,
  readConfigFileSnapshot,
  writeConfigFile,
} from "../shared/config/config.js";
import { applyPluginAutoEnable } from "../shared/config/plugin-auto-enable.js";
import { runOnboardingWizard } from "../wizard/onboarding.js";
import { startGatewayConfigReloader } from "./config-reload.js";
import { ExecApprovalManager } from "./exec-approval-manager.js";
import { NodeRegistry } from "./node-registry.js";
import { createChannelManager } from "./server-channels.js";
import { createAgentEventHandler } from "./server-chat.js";
import { createGatewayCloseHandler } from "./server-close.js";
import { buildGatewayCronService } from "./server-cron.js";
import { startGatewayDiscovery } from "./server-discovery-runtime.js";
import { applyGatewayLaneConcurrency } from "./server-lanes.js";
import { startGatewayMaintenanceTimers } from "./server-maintenance.js";
import { GATEWAY_EVENTS, listGatewayMethods } from "./server-methods-list.js";
import { coreGatewayHandlers } from "./server-methods.js";
import { createExecApprovalHandlers } from "./server-methods/exec-approval.js";
import { safeParseJson } from "./server-methods/nodes.helpers.js";
import { hasConnectedMobileNode } from "./server-mobile-nodes.js";
import { loadGatewayModelCatalog } from "./server-model-catalog.js";
import { createNodeSubscriptionManager } from "./server-node-subscriptions.js";
import { loadGatewayPlugins } from "./server-plugins.js";
import { createGatewayReloadHandlers } from "./server-reload-handlers.js";
import { resolveGatewayRuntimeConfig } from "./server-runtime-config.js";
import { createGatewayRuntimeState } from "./server-runtime-state.js";
import { resolveSessionKeyForRun } from "./server-session-key.js";
import { logGatewayStartup } from "./server-startup-log.js";
import { startGatewaySidecars } from "./server-startup.js";
import { startGatewayTailscaleExposure } from "./server-tailscale.js";
import { createWizardSessionTracker } from "./server-wizard-sessions.js";
import { attachGatewayWsHandlers } from "./server-ws-runtime.js";
import {
  getHealthCache,
  getHealthVersion,
  getPresenceVersion,
  incrementPresenceVersion,
  refreshGatewayHealthSnapshot,
} from "./server/health-state.js";
import { loadGatewayTlsRuntime } from "./server/tls.js";

export { __resetModelCatalogCacheForTest } from "./server-model-catalog.js";

ensureOpenClawCliOnPath();

const log = createSubsystemLogger("gateway");
const logCanvas = log.child("canvas");
const logDiscovery = log.child("discovery");
const logTailscale = log.child("tailscale");
const logChannels = log.child("channels");
const logBrowser = log.child("browser");
const logHealth = log.child("health");
const logCron = log.child("cron");
const logReload = log.child("reload");
const logHooks = log.child("hooks");
const logPlugins = log.child("plugins");
const logWsControl = log.child("ws");
const gatewayRuntime = runtimeForLogger(log);
const canvasRuntime = runtimeForLogger(logCanvas);

export type GatewayServer = {
  close: (opts?: { reason?: string; restartExpectedMs?: number | null }) => Promise<void>;
};

export type GatewayServerOptions = {
  /**
   * Bind address policy for the Gateway WebSocket/HTTP server.
   * - loopback: 127.0.0.1
   * - lan: 0.0.0.0
   * - tailnet: bind only to the Tailscale IPv4 address (100.64.0.0/10)
   * - auto: prefer loopback, else LAN
   */
  bind?: import("../shared/config/config.js").GatewayBindMode;
  /**
   * Advanced override for the bind host, bypassing bind resolution.
   * Prefer `bind` unless you really need a specific address.
   */
  host?: string;
  /**
   * If false, do not serve the browser Control UI.
   * Default: config `gateway.controlUi.enabled` (or true when absent).
   */
  controlUiEnabled?: boolean;
  /**
   * If false, do not serve `POST /v1/chat/completions`.
   * Default: config `gateway.http.endpoints.chatCompletions.enabled` (or false when absent).
   */
  openAiChatCompletionsEnabled?: boolean;
  /**
   * If false, do not serve `POST /v1/responses` (OpenResponses API).
   * Default: config `gateway.http.endpoints.responses.enabled` (or false when absent).
   */
  openResponsesEnabled?: boolean;
  /**
   * Override gateway auth configuration (merges with config).
   */
  auth?: import("../shared/config/config.js").GatewayAuthConfig;
  /**
   * Override gateway Tailscale exposure configuration (merges with config).
   */
  tailscale?: import("../shared/config/config.js").GatewayTailscaleConfig;
  /**
   * Test-only: allow canvas host startup even when NODE_ENV/VITEST would disable it.
   */
  allowCanvasHostInTests?: boolean;
  /**
   * Test-only: override the onboarding wizard runner.
   */
  wizardRunner?: (
    opts: import("../commands/onboard-types.js").OnboardOptions,
    runtime: import("../runtime.js").RuntimeEnv,
    prompter: import("../wizard/prompts.js").WizardPrompter,
  ) => Promise<void>;
};

export async function startGatewayServer(
  port = 18789,
  opts: GatewayServerOptions = {},
): Promise<GatewayServer> {
  // Ensure all default port derivations (browser/canvas) see the actual runtime port.
  process.env.OPENCLAW_GATEWAY_PORT = String(port);
  logAcceptedEnvOption({
    key: "OPENCLAW_RAW_STREAM",
    description: "raw stream logging enabled",
  });
  logAcceptedEnvOption({
    key: "OPENCLAW_RAW_STREAM_PATH",
    description: "raw stream log path override",
  });

  let configSnapshot = await readConfigFileSnapshot();
  if (configSnapshot.legacyIssues.length > 0) {
    if (isNixMode) {
      throw new Error(
        "Legacy config entries detected while running in Nix mode. Update your Nix config to the latest schema and restart.",
      );
    }
    const { config: migrated, changes } = migrateLegacyConfig(configSnapshot.parsed);
    if (!migrated) {
      throw new Error(
        `Legacy config entries detected but auto-migration failed. Run "${formatCliCommand("openclaw doctor")}" to migrate.`,
      );
    }
    await writeConfigFile(migrated);
    if (changes.length > 0) {
      log.info(
        `gateway: migrated legacy config entries:\n${changes
          .map((entry) => `- ${entry}`)
          .join("\n")}`,
      );
    }
  }

  configSnapshot = await readConfigFileSnapshot();
  if (configSnapshot.exists && !configSnapshot.valid) {
    const issues =
      configSnapshot.issues.length > 0
        ? configSnapshot.issues
            .map((issue) => `${issue.path || "<root>"}: ${issue.message}`)
            .join("\n")
        : "Unknown validation issue.";
    throw new Error(
      `Invalid config at ${configSnapshot.path}.\n${issues}\nRun "${formatCliCommand("openclaw doctor")}" to repair, then retry.`,
    );
  }

  const autoEnable = applyPluginAutoEnable({ config: configSnapshot.config, env: process.env });
  if (autoEnable.changes.length > 0) {
    try {
      await writeConfigFile(autoEnable.config);
      log.info(
        `gateway: auto-enabled plugins:\n${autoEnable.changes
          .map((entry) => `- ${entry}`)
          .join("\n")}`,
      );
    } catch (err) {
      log.warn(`gateway: failed to persist plugin auto-enable changes: ${String(err)}`);
    }
  }

  const cfgAtStart = loadConfig();
  const diagnosticsEnabled = isDiagnosticsEnabled(cfgAtStart);
  if (diagnosticsEnabled) {
    startDiagnosticHeartbeat();
  }
  setGatewaySigusr1RestartPolicy({ allowExternal: cfgAtStart.commands?.restart === true });
  initSubagentRegistry();
  const defaultAgentId = resolveDefaultAgentId(cfgAtStart);
  const defaultWorkspaceDir = resolveAgentWorkspaceDir(cfgAtStart, defaultAgentId);
  const baseMethods = listGatewayMethods();
  const { pluginRegistry, gatewayMethods: baseGatewayMethods } = loadGatewayPlugins({
    cfg: cfgAtStart,
    workspaceDir: defaultWorkspaceDir,
    log,
    coreGatewayHandlers,
    baseMethods,
  });
  const channelLogs = Object.fromEntries(
    listChannelPlugins().map((plugin) => [plugin.id, logChannels.child(plugin.id)]),
  ) as Record<ChannelId, ReturnType<typeof createSubsystemLogger>>;
  const channelRuntimeEnvs = Object.fromEntries(
    Object.entries(channelLogs).map(([id, logger]) => [id, runtimeForLogger(logger)]),
  ) as Record<ChannelId, RuntimeEnv>;
  const channelMethods = listChannelPlugins().flatMap((plugin) => plugin.gatewayMethods ?? []);
  const gatewayMethods = Array.from(new Set([...baseGatewayMethods, ...channelMethods]));
  let pluginServices: PluginServicesHandle | null = null;
  const runtimeConfig = await resolveGatewayRuntimeConfig({
    cfg: cfgAtStart,
    port,
    bind: opts.bind,
    host: opts.host,
    controlUiEnabled: opts.controlUiEnabled,
    openAiChatCompletionsEnabled: opts.openAiChatCompletionsEnabled,
    openResponsesEnabled: opts.openResponsesEnabled,
    auth: opts.auth,
    tailscale: opts.tailscale,
  });
  const {
    bindHost,
    controlUiEnabled,
    openAiChatCompletionsEnabled,
    openResponsesEnabled,
    openResponsesConfig,
    controlUiBasePath,
    controlUiRoot: controlUiRootOverride,
    resolvedAuth,
    tailscaleConfig,
    tailscaleMode,
  } = runtimeConfig;
  let hooksConfig = runtimeConfig.hooksConfig;
  const canvasHostEnabled = runtimeConfig.canvasHostEnabled;

  let controlUiRootState: ControlUiRootState | undefined;
  if (controlUiRootOverride) {
    const resolvedOverride = resolveControlUiRootOverrideSync(controlUiRootOverride);
    const resolvedOverridePath = path.resolve(controlUiRootOverride);
    controlUiRootState = resolvedOverride
      ? { kind: "resolved", path: resolvedOverride }
      : { kind: "invalid", path: resolvedOverridePath };
    if (!resolvedOverride) {
      log.warn(`gateway: controlUi.root not found at ${resolvedOverridePath}`);
    }
  } else if (controlUiEnabled) {
    let resolvedRoot = resolveControlUiRootSync({
      moduleUrl: import.meta.url,
      argv1: process.argv[1],
      cwd: process.cwd(),
    });
    if (!resolvedRoot) {
      const ensureResult = await ensureControlUiAssetsBuilt(gatewayRuntime);
      if (!ensureResult.ok && ensureResult.message) {
        log.warn(`gateway: ${ensureResult.message}`);
      }
      resolvedRoot = resolveControlUiRootSync({
        moduleUrl: import.meta.url,
        argv1: process.argv[1],
        cwd: process.cwd(),
      });
    }
    controlUiRootState = resolvedRoot
      ? { kind: "resolved", path: resolvedRoot }
      : { kind: "missing" };
  }

  const wizardRunner = opts.wizardRunner ?? runOnboardingWizard;
  const { wizardSessions, findRunningWizard, purgeWizardSession } = createWizardSessionTracker();

  const deps = createDefaultDeps();
  let canvasHostServer: CanvasHostServer | null = null;
  const gatewayTls = await loadGatewayTlsRuntime(cfgAtStart.gateway?.tls, log.child("tls"));
  if (cfgAtStart.gateway?.tls?.enabled && !gatewayTls.enabled) {
    throw new Error(gatewayTls.error ?? "gateway tls: failed to enable");
  }
  const {
    canvasHost,
    httpServer,
    httpServers,
    httpBindHosts,
    wss,
    clients,
    broadcast,
    broadcastToConnIds,
    agentRunSeq,
    dedupe,
    chatRunState,
    chatRunBuffers,
    chatDeltaSentAt,
    addChatRun,
    removeChatRun,
    chatAbortControllers,
    toolEventRecipients,
  } = await createGatewayRuntimeState({
    cfg: cfgAtStart,
    bindHost,
    port,
    controlUiEnabled,
    controlUiBasePath,
    controlUiRoot: controlUiRootState,
    openAiChatCompletionsEnabled,
    openResponsesEnabled,
    openResponsesConfig,
    resolvedAuth,
    gatewayTls,
    hooksConfig: () => hooksConfig,
    pluginRegistry,
    deps,
    canvasRuntime,
    canvasHostEnabled,
    allowCanvasHostInTests: opts.allowCanvasHostInTests,
    logCanvas,
    log,
    logHooks,
    logPlugins,
  });
  let bonjourStop: (() => Promise<void>) | null = null;
  const nodeRegistry = new NodeRegistry();
  const nodePresenceTimers = new Map<string, ReturnType<typeof setInterval>>();
  const nodeSubscriptions = createNodeSubscriptionManager();
  const nodeSendEvent = (opts: { nodeId: string; event: string; payloadJSON?: string | null }) => {
    const payload = safeParseJson(opts.payloadJSON ?? null);
    nodeRegistry.sendEvent(opts.nodeId, opts.event, payload);
  };
  const nodeSendToSession = (sessionKey: string, event: string, payload: unknown) =>
    nodeSubscriptions.sendToSession(sessionKey, event, payload, nodeSendEvent);
  const nodeSendToAllSubscribed = (event: string, payload: unknown) =>
    nodeSubscriptions.sendToAllSubscribed(event, payload, nodeSendEvent);
  const nodeSubscribe = nodeSubscriptions.subscribe;
  const nodeUnsubscribe = nodeSubscriptions.unsubscribe;
  const nodeUnsubscribeAll = nodeSubscriptions.unsubscribeAll;
  const broadcastVoiceWakeChanged = (triggers: string[]) => {
    broadcast("voicewake.changed", { triggers }, { dropIfSlow: true });
  };
  const hasMobileNodeConnected = () => hasConnectedMobileNode(nodeRegistry);
  applyGatewayLaneConcurrency(cfgAtStart);

  let cronState = buildGatewayCronService({
    cfg: cfgAtStart,
    deps,
    broadcast,
  });
  let { cron, storePath: cronStorePath } = cronState;

  const channelManager = createChannelManager({
    loadConfig,
    channelLogs,
    channelRuntimeEnvs,
  });
  const { getRuntimeSnapshot, startChannels, startChannel, stopChannel, markChannelLoggedOut } =
    channelManager;

  const machineDisplayName = await getMachineDisplayName();
  const discovery = await startGatewayDiscovery({
    machineDisplayName,
    port,
    gatewayTls: gatewayTls.enabled
      ? { enabled: true, fingerprintSha256: gatewayTls.fingerprintSha256 }
      : undefined,
    wideAreaDiscoveryEnabled: cfgAtStart.discovery?.wideArea?.enabled === true,
    wideAreaDiscoveryDomain: cfgAtStart.discovery?.wideArea?.domain,
    tailscaleMode,
    mdnsMode: cfgAtStart.discovery?.mdns?.mode,
    logDiscovery,
  });
  bonjourStop = discovery.bonjourStop;

  setSkillsRemoteRegistry(nodeRegistry);
  void primeRemoteSkillsCache();
  // Debounce skills-triggered node probes to avoid feedback loops and rapid-fire invokes.
  // Skills changes can happen in bursts (e.g., file watcher events), and each probe
  // takes time to complete. A 30-second delay ensures we batch changes together.
  let skillsRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  const skillsRefreshDelayMs = 30_000;
  const skillsChangeUnsub = registerSkillsChangeListener((event) => {
    if (event.reason === "remote-node") {
      return;
    }
    if (skillsRefreshTimer) {
      clearTimeout(skillsRefreshTimer);
    }
    skillsRefreshTimer = setTimeout(() => {
      skillsRefreshTimer = null;
      const latest = loadConfig();
      void refreshRemoteBinsForConnectedNodes(latest);
    }, skillsRefreshDelayMs);
  });

  const { tickInterval, healthInterval, dedupeCleanup } = startGatewayMaintenanceTimers({
    broadcast,
    nodeSendToAllSubscribed,
    getPresenceVersion,
    getHealthVersion,
    refreshGatewayHealthSnapshot,
    logHealth,
    dedupe,
    chatAbortControllers,
    chatRunState,
    chatRunBuffers,
    chatDeltaSentAt,
    removeChatRun,
    agentRunSeq,
    nodeSendToSession,
  });

  const agentUnsub = onAgentEvent(
    createAgentEventHandler({
      broadcast,
      broadcastToConnIds,
      nodeSendToSession,
      agentRunSeq,
      chatRunState,
      resolveSessionKeyForRun,
      clearAgentRunContext,
      toolEventRecipients,
    }),
  );

  const heartbeatUnsub = onHeartbeatEvent((evt) => {
    broadcast("heartbeat", evt, { dropIfSlow: true });
  });

  let heartbeatRunner = startHeartbeatRunner({ cfg: cfgAtStart });
  const consolidationRunner = startConsolidationRunner({ cfg: cfgAtStart });

  // Wire the embedding provider into structured memory banks so vector search
  // works out of the box.  Fire-and-forget — gateway startup should not block
  // on embedding provider initialisation.
  void import("../brain/memory/drofbot-memory.js").then((m) =>
    m
      .initStructuredMemoryEmbeddings(cfgAtStart)
      .catch((err) =>
        log.warn(
          `Structured memory embedding init failed: ${err instanceof Error ? err.message : String(err)}`,
        ),
      ),
  );

  // Configure the synthesis engine so /api/profile/synthesis and
  // /api/cosmic/synthesis can serve cached data.  Fire-and-forget — matches the
  // embedding init style above.
  void (async () => {
    try {
      const { configureSynthesisEngine, runSynthesisCycle } =
        await import("../brain/synthesis/synthesis-runner.js");
      const { getCouncil } = await import("../brain/council/index.js");
      const { calculateHarmonicSynthesis } = await import("../brain/council/harmonic.js");
      const { getHypothesisEngine } = await import("../brain/intelligence/observer-runner.js");
      const { getDrofbotMemory } = await import("../brain/memory/drofbot-memory.js");
      const { parseBirthMomentConfig } = await import("../shared/config/types.council.js");
      const council = getCouncil();
      const councilCfg = cfgAtStart.council;
      const operatorBirth = councilCfg?.operatorBirth
        ? parseBirthMomentConfig(councilCfg.operatorBirth)
        : null;
      configureSynthesisEngine(
        {
          calculateCosmicStates: (birth) => council.calculateAll(birth, new Date()),
          getCosmicTimestamp: (birth) => council.getCosmicTimestamp(birth),
          calculateHarmonic: async (states) => {
            const archetypeMappings = [...states.entries()]
              .map(([name, state]) => {
                const system = council.getSystem(name);
                return system ? system.archetypes(state) : null;
              })
              .filter((m): m is NonNullable<typeof m> => m !== null);
            if (archetypeMappings.length === 0) return null;
            return calculateHarmonicSynthesis(states, archetypeMappings);
          },
          getActiveHypotheses: () => {
            try {
              return getHypothesisEngine().getActive();
            } catch {
              return []; // Cold-start: observer hasn't run yet
            }
          },
          getConfirmedHypotheses: () => {
            try {
              return getHypothesisEngine().getConfirmed();
            } catch {
              return []; // Cold-start: observer hasn't run yet
            }
          },
          getRecentEpisodicContext: async (limit) => {
            const memory = getDrofbotMemory();
            if (!memory.isStructuredMemoryAvailable) return [];
            const entries = await memory.episodic.getRecent(limit);
            return entries.map((e) => e.content);
          },
          getSemanticByCategory: async (category) => {
            const memory = getDrofbotMemory();
            if (!memory.isStructuredMemoryAvailable) return [];
            const entries = await memory.semantic.getByCategory(category);
            return entries.map((e) => e.content);
          },
          getSelfKnowledge: async () => {
            const memory = getDrofbotMemory();
            if (!memory.isStructuredMemoryAvailable) return [];
            const entries = await memory.semantic.getByCategory("self");
            return entries.map((e) => e.content);
          },
        },
        operatorBirth,
        null, // agentBirth — not configured yet
      );
      await runSynthesisCycle();
      log.info("synthesis engine configured and initial cycle complete");

      // Re-run synthesis every 6 hours to keep cosmic context fresh.
      // Staggered by 1 hour from the observer runner to avoid thundering herd.
      const SYNTHESIS_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
      setInterval(() => {
        runSynthesisCycle().catch((err) =>
          log.warn(`Synthesis periodic re-run failed: ${err instanceof Error ? err.message : String(err)}`),
        );
      }, SYNTHESIS_INTERVAL_MS);
    } catch (err) {
      log.warn(`Synthesis engine init failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  })();

  // Observer runner — every 6 hours, detect patterns in episodic memory.
  // Fire-and-forget — gateway startup should not block on first cycle.
  void (async () => {
    try {
      const { runObserverCycle } = await import("../brain/intelligence/observer-runner.js");
      const { getDrofbotMemory } = await import("../brain/memory/drofbot-memory.js");

      const OBSERVER_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

      const runCycle = async () => {
        const memory = getDrofbotMemory();
        if (!memory.isStructuredMemoryAvailable) {
          log.debug("Observer skipped: structured memory not available");
          return;
        }

        const loader = {
          loadRecentEntries: async (lookbackDays: number) => {
            const entries = await memory.episodic.getRecent(500, {
              after: new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString(),
            });
            return entries.map((e) => ({
              id: e.id,
              content: e.content,
              createdAt: new Date(e.created_at),
              mood: (e.context as Record<string, unknown> | null)?.mood as number | undefined,
              energy: (e.context as Record<string, unknown> | null)?.energy as number | undefined,
              cosmic: (e.context as Record<string, unknown> | null)?.cosmic as
                import("../brain/council/enrichment.js").CosmicSnapshot | undefined,
            }));
          },
        };

        const result = await runObserverCycle(loader);
        log.info(
          `Observer cycle complete: ${result.patternsDetected} patterns, ` +
          `${result.hypothesesGenerated} hypotheses generated`,
        );
      };

      // Run first cycle after a short delay (let other systems initialize)
      setTimeout(() => {
        runCycle().catch((err) =>
          log.warn(`Observer initial cycle failed: ${err instanceof Error ? err.message : String(err)}`),
        );
      }, 30_000); // 30 second delay

      // Schedule periodic runs
      setInterval(() => {
        runCycle().catch((err) =>
          log.warn(`Observer periodic cycle failed: ${err instanceof Error ? err.message : String(err)}`),
        );
      }, OBSERVER_INTERVAL_MS);
    } catch (err) {
      log.warn(`Observer runner init failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  })();

  // Expression evaluator — every 45 minutes, check for spontaneous thoughts.
  // Checks frequently, but the throttle config prevents actual message spam.
  // Fire-and-forget — gateway startup should not block.
  void (async () => {
    try {
      const { evaluateExpressions } = await import("../brain/expression/engine.js");
      const { getHypothesisEngine } = await import("../brain/intelligence/observer-runner.js");
      const { getCouncil } = await import("../brain/council/index.js");
      const { sendMessageTelegram } = await import("../channels/telegram/send.js");
      const vault = await import("../brain/identity/operator/vault.js");
      const { isSupabaseConfigured, getSupabaseClient } = await import(
        "../shared/database/client.js"
      );
      const { parseBirthMomentConfig } = await import("../shared/config/types.council.js");

      const EXPRESSION_INTERVAL_MS = 45 * 60 * 1000; // 45 minutes

      // Resolve operator Telegram chat ID from config for proactive delivery.
      const tgAccounts = cfgAtStart.channels?.telegram?.accounts;
      const defaultAccount =
        tgAccounts && typeof tgAccounts === "object"
          ? (tgAccounts as Record<string, { allowFrom?: Array<string | number> }>).default
          : undefined;
      const operatorChatId = defaultAccount?.allowFrom?.[0]
        ? String(defaultAccount.allowFrom[0])
        : null;

      if (!operatorChatId) {
        log.warn("Expression evaluator: no operator chat ID found in telegram config — delivery disabled");
      }

      const buildDeps = () => {
        const council = getCouncil();
        const hypothesisEngine = getHypothesisEngine();
        const councilCfg = cfgAtStart.council;
        const operatorBirth = councilCfg?.operatorBirth
          ? parseBirthMomentConfig(councilCfg.operatorBirth)
          : null;

        return {
          getCosmicStates: async () => {
            if (!operatorBirth) return new Map();
            return council.calculateAll(operatorBirth, new Date());
          },
          getActiveHypotheses: () => {
            return hypothesisEngine.getActive().map((h) => ({
              description: h.statement,
              confidence: h.confidence,
              category: h.category,
              status: h.status,
            }));
          },
          getConfirmedHypotheses: () => {
            return hypothesisEngine.getConfirmed().map((h) => ({
              description: h.statement,
              confidence: h.confidence,
              category: h.category,
            }));
          },
          getRecentInsight: () => {
            const active = hypothesisEngine.getActive();
            const recent = active.find((h) => h.confidence >= 0.7);
            return recent?.statement ?? null;
          },

          // ── Live vault data ──────────────────────────────────
          getVoiceProfile: () => vault.getVoiceProfile(),
          getInteractionPreferences: () => vault.getInteractionPreferences(),
          getOperatorSynthesis: async () => {
            const synthesis = await vault.getIdentitySynthesis();
            return synthesis.rendered || "";
          },

          // ── Supabase expression history ──────────────────────
          getRecentExpressions: async (withinMs: number) => {
            if (!isSupabaseConfigured()) return [];
            try {
              const client = getSupabaseClient();
              const since = new Date(Date.now() - withinMs).toISOString();
              const { data, error } = await client
                .from("expressions")
                .select("*")
                .gte("created_at", since)
                .order("created_at", { ascending: false });
              if (error || !data) return [];
              return data.map((row: Record<string, unknown>) => ({
                id: row.id as string,
                content: (row.content as string) ?? "",
                significanceScore: (row.significance as number) ?? 0,
                triggers: [],
                deliveredAt: (row.created_at as string) ?? new Date().toISOString(),
                channel: (row.channel as string) ?? "telegram",
                engagement: null,
              }));
            } catch (err) {
              log.warn(
                `Expression history query failed: ${err instanceof Error ? err.message : String(err)}`,
              );
              return [];
            }
          },
          storeExpression: async (
            expr: import("../brain/expression/types.js").DeliveredExpression,
          ) => {
            if (!isSupabaseConfigured()) return;
            try {
              const client = getSupabaseClient();
              await client.from("expressions").insert({
                id: expr.id,
                trigger_kind: expr.triggers[0]?.kind ?? "agent_state",
                topic: expr.triggers[0]?.description ?? null,
                significance: expr.significanceScore,
                content: expr.content,
                delivered: true,
                channel: expr.channel,
                metadata: { triggers: expr.triggers },
                created_at: expr.deliveredAt,
              });
            } catch (err) {
              log.warn(
                `Expression store failed: ${err instanceof Error ? err.message : String(err)}`,
              );
            }
          },

          // ── Real Telegram delivery ───────────────────────────
          deliver: async (content: string, _channel: string) => {
            if (!operatorChatId) {
              log.warn("[Expression] No operator chat ID — cannot deliver");
              return false;
            }
            try {
              const result = await sendMessageTelegram(operatorChatId, content);
              log.info(
                `[Expression] Delivered to Telegram (msgId=${result.messageId}): ${content.slice(0, 80)}…`,
              );
              return true;
            } catch (err) {
              log.warn(
                `[Expression] Telegram delivery failed: ${err instanceof Error ? err.message : String(err)}`,
              );
              return false;
            }
          },
        };
      };

      // Run first evaluation after a 2-minute delay
      setTimeout(() => {
        evaluateExpressions(buildDeps()).catch((err) =>
          log.warn(`Expression initial eval failed: ${err instanceof Error ? err.message : String(err)}`),
        );
      }, 120_000); // 2 minute delay

      // Schedule periodic evaluations
      setInterval(() => {
        evaluateExpressions(buildDeps()).catch((err) =>
          log.warn(`Expression eval failed: ${err instanceof Error ? err.message : String(err)}`),
        );
      }, EXPRESSION_INTERVAL_MS);

      log.info(
        `Expression evaluator scheduled (every 45m, delivery=${operatorChatId ? "enabled" : "disabled"})`,
      );
    } catch (err) {
      log.warn(`Expression evaluator init failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  })();

  // Initialize the ProgressionEngine with Supabase persistence.
  // Loads stats from player_stats table; creates default record if none exists.
  // Wraps addXP() to persist state changes back to Supabase.
  void (async () => {
    try {
      const { ProgressionEngine, createDefaultStats } = await import(
        "../brain/progression/engine.js"
      );
      const { setProgressionEngine } = await import("../brain/progression/tools.js");
      const { isSupabaseConfigured, getSupabaseClient } = await import(
        "../shared/database/client.js"
      );

      let stats = createDefaultStats("default");
      let statsRowId: string | null = null;

      // Try to load from Supabase
      if (isSupabaseConfigured()) {
        try {
          const client = getSupabaseClient();
          const { data, error } = await client
            .from("player_stats")
            .select("*")
            .eq("operator_id", "default")
            .single();

          if (!error && data) {
            stats = {
              id: data.id as string,
              operatorId: (data.operator_id as string) ?? "default",
              totalXp: (data.total_xp as number) ?? 0,
              currentLevel: (data.current_level as number) ?? 1,
              currentRank: (data.current_rank as string as import("../brain/progression/types.js").RankId) ?? "E",
              syncRate: (data.sync_rate as number) ?? 0,
              streakDays: (data.streak_days as number) ?? 0,
              syncHistory: (data.sync_history as import("../brain/progression/types.js").SyncHistoryEntry[]) ?? [],
              lastActive: (data.last_active as string) ?? null,
            };
            statsRowId = stats.id;
            log.info(
              `Progression loaded from Supabase: Level ${stats.currentLevel}, XP ${stats.totalXp}, Rank ${stats.currentRank}`,
            );
          } else {
            // No record — insert default stats
            const { error: insertErr } = await client.from("player_stats").insert({
              id: stats.id,
              operator_id: stats.operatorId,
              total_xp: stats.totalXp,
              current_level: stats.currentLevel,
              current_rank: stats.currentRank,
              sync_rate: stats.syncRate,
              streak_days: stats.streakDays,
              sync_history: stats.syncHistory,
              last_active: stats.lastActive,
            });
            if (!insertErr) {
              statsRowId = stats.id;
              log.info("Progression: created default stats in Supabase");
            }
          }
        } catch (err) {
          log.warn(`Progression Supabase load failed, using defaults: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      const engine = new ProgressionEngine(stats);

      // Wrap addXP to persist state changes
      const originalAddXP = engine.addXP.bind(engine);
      engine.addXP = (amount: number, reason?: string) => {
        const result = originalAddXP(amount, reason);

        // Fire-and-forget Supabase upsert
        if (isSupabaseConfigured() && statsRowId) {
          const updated = engine.getStats();
          const client = getSupabaseClient();
          client
            .from("player_stats")
            .update({
              total_xp: updated.totalXp,
              current_level: updated.currentLevel,
              current_rank: updated.currentRank,
              sync_rate: updated.syncRate,
              streak_days: updated.streakDays,
              sync_history: updated.syncHistory,
              last_active: updated.lastActive,
              updated_at: new Date().toISOString(),
            })
            .eq("id", statsRowId)
            .then(({ error }) => {
              if (error) {
                log.warn(`Progression save failed: ${error.message}`);
              }
            });
        }

        return result;
      };

      // Load quests from Supabase
      if (isSupabaseConfigured()) {
        try {
          const client = getSupabaseClient();
          const { data, error } = await client
            .from("quests")
            .select("*")
            .in("status", ["active", "completed"]);

          if (!error && data && data.length > 0) {
            const quests = data.map((row: Record<string, unknown>) => ({
              id: row.id as string,
              title: row.title as string,
              description: row.description as string,
              questType: row.quest_type as import("../brain/progression/types.js").QuestType,
              difficulty: (row.difficulty as import("../brain/progression/types.js").QuestDifficulty) ?? "medium",
              xpReward: (row.xp_reward as number) ?? 100,
              status: row.status as import("../brain/progression/types.js").QuestStatus,
              cosmicAlignment: (row.cosmic_alignment as number) ?? null,
              insightId: (row.insight_id as string) ?? null,
              source: (row.source as import("../brain/progression/types.js").QuestSource) ?? "agent",
              assignedAt: new Date(row.assigned_at as string),
              completedAt: row.completed_at ? new Date(row.completed_at as string) : null,
              expiresAt: row.expires_at ? new Date(row.expires_at as string) : null,
              metadata: (row.metadata as Record<string, unknown>) ?? {},
            }));
            engine.loadQuests(quests);
            log.info(`Progression: loaded ${quests.length} quests from Supabase`);
          }
        } catch (err) {
          log.warn(`Quest load failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      setProgressionEngine(engine);
      log.info(
        `Progression engine initialized (Level ${stats.currentLevel}, XP ${stats.totalXp}, Rank ${stats.currentRank})`,
      );
    } catch (err) {
      log.warn(`Progression engine init failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  })();

  void cron.start().catch((err) => logCron.error(`failed to start: ${String(err)}`));

  const execApprovalManager = new ExecApprovalManager();
  const execApprovalForwarder = createExecApprovalForwarder();
  const execApprovalHandlers = createExecApprovalHandlers(execApprovalManager, {
    forwarder: execApprovalForwarder,
  });

  const canvasHostServerPort = (canvasHostServer as CanvasHostServer | null)?.port;

  attachGatewayWsHandlers({
    wss,
    clients,
    port,
    gatewayHost: bindHost ?? undefined,
    canvasHostEnabled: Boolean(canvasHost),
    canvasHostServerPort,
    resolvedAuth,
    gatewayMethods,
    events: GATEWAY_EVENTS,
    logGateway: log,
    logHealth,
    logWsControl,
    extraHandlers: {
      ...pluginRegistry.gatewayHandlers,
      ...execApprovalHandlers,
    },
    broadcast,
    context: {
      deps,
      cron,
      cronStorePath,
      loadGatewayModelCatalog,
      getHealthCache,
      refreshHealthSnapshot: refreshGatewayHealthSnapshot,
      logHealth,
      logGateway: log,
      incrementPresenceVersion,
      getHealthVersion,
      broadcast,
      broadcastToConnIds,
      nodeSendToSession,
      nodeSendToAllSubscribed,
      nodeSubscribe,
      nodeUnsubscribe,
      nodeUnsubscribeAll,
      hasConnectedMobileNode: hasMobileNodeConnected,
      nodeRegistry,
      agentRunSeq,
      chatAbortControllers,
      chatAbortedRuns: chatRunState.abortedRuns,
      chatRunBuffers: chatRunState.buffers,
      chatDeltaSentAt: chatRunState.deltaSentAt,
      addChatRun,
      removeChatRun,
      registerToolEventRecipient: toolEventRecipients.add,
      dedupe,
      wizardSessions,
      findRunningWizard,
      purgeWizardSession,
      getRuntimeSnapshot,
      startChannel,
      stopChannel,
      markChannelLoggedOut,
      wizardRunner,
      broadcastVoiceWakeChanged,
    },
  });
  logGatewayStartup({
    cfg: cfgAtStart,
    bindHost,
    bindHosts: httpBindHosts,
    port,
    tlsEnabled: gatewayTls.enabled,
    log,
    isNixMode,
  });
  scheduleGatewayUpdateCheck({ cfg: cfgAtStart, log, isNixMode });
  const tailscaleCleanup = await startGatewayTailscaleExposure({
    tailscaleMode,
    resetOnExit: tailscaleConfig.resetOnExit,
    port,
    controlUiBasePath,
    logTailscale,
  });

  let browserControl: Awaited<ReturnType<typeof startBrowserControlServerIfEnabled>> = null;
  ({ browserControl, pluginServices } = await startGatewaySidecars({
    cfg: cfgAtStart,
    pluginRegistry,
    defaultWorkspaceDir,
    deps,
    startChannels,
    log,
    logHooks,
    logChannels,
    logBrowser,
  }));

  const { applyHotReload, requestGatewayRestart } = createGatewayReloadHandlers({
    deps,
    broadcast,
    getState: () => ({
      hooksConfig,
      heartbeatRunner,
      cronState,
      browserControl,
    }),
    setState: (nextState) => {
      hooksConfig = nextState.hooksConfig;
      heartbeatRunner = nextState.heartbeatRunner;
      cronState = nextState.cronState;
      cron = cronState.cron;
      cronStorePath = cronState.storePath;
      browserControl = nextState.browserControl;
    },
    startChannel,
    stopChannel,
    logHooks,
    logBrowser,
    logChannels,
    logCron,
    logReload,
  });

  const configReloader = startGatewayConfigReloader({
    initialConfig: cfgAtStart,
    readSnapshot: readConfigFileSnapshot,
    onHotReload: applyHotReload,
    onRestart: requestGatewayRestart,
    log: {
      info: (msg) => logReload.info(msg),
      warn: (msg) => logReload.warn(msg),
      error: (msg) => logReload.error(msg),
    },
    watchPath: CONFIG_PATH,
  });

  const close = createGatewayCloseHandler({
    bonjourStop,
    tailscaleCleanup,
    canvasHost,
    canvasHostServer,
    stopChannel,
    pluginServices,
    cron,
    heartbeatRunner,
    consolidationRunner,
    nodePresenceTimers,
    broadcast,
    tickInterval,
    healthInterval,
    dedupeCleanup,
    agentUnsub,
    heartbeatUnsub,
    chatRunState,
    clients,
    configReloader,
    browserControl,
    wss,
    httpServer,
    httpServers,
  });

  return {
    close: async (opts) => {
      if (diagnosticsEnabled) {
        stopDiagnosticHeartbeat();
      }
      if (skillsRefreshTimer) {
        clearTimeout(skillsRefreshTimer);
        skillsRefreshTimer = null;
      }
      skillsChangeUnsub();
      await close(opts);
    },
  };
}
