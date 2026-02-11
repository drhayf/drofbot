/**
 * Brain ↔ Worker Protocol
 *
 * Extends the existing Gateway protocol with message types for
 * Brain/Hands communication. The Worker is a new type of WebSocket
 * client that connects to the Gateway and executes local-only tools.
 *
 * These types are used within the existing Gateway frame system:
 * - Brain→Worker messages are sent as EventFrame (type: "event")
 * - Worker→Brain messages are sent as RequestFrame (type: "req")
 *
 * @see DROFBOT-FORK-VISION.md section 2 (Brain/Hands Architecture)
 */

import { Type, type Static } from "@sinclair/typebox";
import { NonEmptyString } from "./primitives.js";

// ---------------------------------------------------------------------------
// Brain → Worker messages (sent as EventFrame payloads)
// ---------------------------------------------------------------------------

/** Brain dispatches a tool execution task to the Worker. */
export const TaskDispatchSchema = Type.Object(
  {
    taskId: NonEmptyString,
    tool: NonEmptyString,
    params: Type.Record(Type.String(), Type.Unknown()),
    priority: Type.Integer({ minimum: 1, maximum: 10 }),
    timeout: Type.Optional(Type.Integer({ minimum: 0 })),
  },
  { additionalProperties: false },
);
export type TaskDispatch = Static<typeof TaskDispatchSchema>;

/** Brain requests the Worker to cancel a running/queued task. */
export const TaskCancelSchema = Type.Object(
  {
    taskId: NonEmptyString,
  },
  { additionalProperties: false },
);
export type TaskCancel = Static<typeof TaskCancelSchema>;

/** Brain acknowledges a Worker registration. */
export const WorkerAckSchema = Type.Object(
  {
    queuedTasks: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);
export type WorkerAck = Static<typeof WorkerAckSchema>;

// ---------------------------------------------------------------------------
// Worker → Brain messages (sent as RequestFrame payloads)
// ---------------------------------------------------------------------------

/** Worker announces itself to the Brain upon first connecting. */
export const WorkerRegisterSchema = Type.Object(
  {
    secret: NonEmptyString,
    capabilities: Type.Array(NonEmptyString),
    hostname: NonEmptyString,
    platform: NonEmptyString,
  },
  { additionalProperties: false },
);
export type WorkerRegister = Static<typeof WorkerRegisterSchema>;

/** Worker periodic heartbeat. */
export const WorkerHeartbeatSchema = Type.Object(
  {
    uptime: Type.Number({ minimum: 0 }),
    load: Type.Number({ minimum: 0 }),
    activeTasks: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);
export type WorkerHeartbeat = Static<typeof WorkerHeartbeatSchema>;

/** Worker reports progress on a running task. */
export const TaskProgressSchema = Type.Object(
  {
    taskId: NonEmptyString,
    progress: Type.Integer({ minimum: 0, maximum: 100 }),
    message: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);
export type TaskProgress = Static<typeof TaskProgressSchema>;

/** Worker reports a completed or failed task. */
export const TaskResultSchema = Type.Object(
  {
    taskId: NonEmptyString,
    status: Type.Union([Type.Literal("completed"), Type.Literal("failed")]),
    result: Type.Optional(Type.Unknown()),
    error: Type.Optional(Type.String()),
    duration: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);
export type TaskResult = Static<typeof TaskResultSchema>;

// ---------------------------------------------------------------------------
// Protocol event & method names
// ---------------------------------------------------------------------------

/**
 * Event names sent from Brain to Worker (via EventFrame).
 * Usage: `{ type: "event", event: WORKER_EVENTS.TASK_DISPATCH, payload: TaskDispatch }`
 */
export const WORKER_EVENTS = {
  TASK_DISPATCH: "worker.task.dispatch",
  TASK_CANCEL: "worker.task.cancel",
  WORKER_ACK: "worker.ack",
} as const;

/**
 * Method names sent from Worker to Brain (via RequestFrame).
 * Usage: `{ type: "req", id: "...", method: WORKER_METHODS.REGISTER, params: WorkerRegister }`
 */
export const WORKER_METHODS = {
  REGISTER: "worker.register",
  HEARTBEAT: "worker.heartbeat",
  TASK_PROGRESS: "worker.task.progress",
  TASK_RESULT: "worker.task.result",
} as const;
