// Barrel exports for the web channel pieces. Splitting the original 900+ line
// module keeps responsibilities small and testable.
export {
  DEFAULT_WEB_MEDIA_BYTES,
  HEARTBEAT_PROMPT,
  HEARTBEAT_TOKEN,
  monitorWebChannel,
  resolveHeartbeatRecipients,
  runWebHeartbeatOnce,
  type WebChannelStatus,
  type WebMonitorTuning,
} from "./channels/web/auto-reply.js";
export {
  extractMediaPlaceholder,
  extractText,
  monitorWebInbox,
  type WebInboundMessage,
  type WebListenerCloseReason,
} from "./channels/web/inbound.js";
export { loginWeb } from "./channels/web/login.js";
export { loadWebMedia, optimizeImageToJpeg } from "./channels/web/media.js";
export { sendMessageWhatsApp } from "./channels/web/outbound.js";
export {
  createWaSocket,
  formatError,
  getStatusCode,
  logoutWeb,
  logWebSelfId,
  pickWebChannel,
  WA_WEB_AUTH_DIR,
  waitForWaConnection,
  webAuthExists,
} from "./channels/web/session.js";
