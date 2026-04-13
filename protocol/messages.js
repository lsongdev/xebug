// Protocol message types
export const MessageTypes = {
  // Connection
  CONNECT: 'connect',
  CONNECTED: 'connected',
  DISCONNECT: 'disconnect',

  // DOM
  DOM_GET_TREE: 'dom:getTree',
  DOM_TREE_RESPONSE: 'dom:treeResponse',
  DOM_GET_STYLE: 'dom:getStyle',
  DOM_STYLE_RESPONSE: 'dom:styleResponse',
  DOM_HIGHLIGHT_NODE: 'dom:highlightNode',
  DOM_HIGHLIGHT_CLEAR: 'dom:highlightClear',

  // Network
  NETWORK_GET_ENTRIES: 'network:getEntries',
  NETWORK_ENTRIES_RESPONSE: 'network:entriesResponse',
  NETWORK_ENTRY_ADDED: 'network:entryAdded',
  NETWORK_GET_ENTRY_DETAILS: 'network:getEntryDetails',
  NETWORK_ENTRY_DETAILS_RESPONSE: 'network:entryDetailsResponse',

  // Storage
  STORAGE_GET_LOCAL: 'storage:getLocal',
  STORAGE_GET_SESSION: 'storage:getSession',
  STORAGE_GET_COOKIES: 'storage:getCookies',
  STORAGE_RESPONSE: 'storage:response',
  STORAGE_DELETE: 'storage:delete',
  STORAGE_CLEAR: 'storage:clear',
  STORAGE_DELETED: 'storage:deleted',

  // Console
  CONSOLE_EVALUATE: 'console:evaluate',
  CONSOLE_EVALUATE_RESULT: 'console:evaluateResult',
  CONSOLE_MESSAGE_ADDED: 'console:messageAdded',

  // Performance
  PERF_GET_METRICS: 'perf:getMetrics',
  PERF_METRICS_RESPONSE: 'perf:metricsResponse',
  PERF_START_MONITORING: 'perf:startMonitoring',
  PERF_STOP_MONITORING: 'perf:stopMonitoring',
  PERF_FPS_UPDATE: 'perf:fpsUpdate',
  PERF_TIMING_UPDATE: 'perf:timingUpdate',

  // Device
  DEVICE_GET_INFO: 'device:getInfo',
  DEVICE_INFO_RESPONSE: 'device:infoResponse',
  DEVICE_SET_ORIENTATION: 'device:setOrientation',
  DEVICE_SET_THROTTLE: 'device:setThrottle',
  DEVICE_SCREENSHOT: 'device:screenshot',
  DEVICE_SCREENSHOT_RESPONSE: 'device:screenshotResponse',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_RESPONSE: 'settings:response',
  SETTINGS_UPDATE: 'settings:update',
  SETTINGS_UPDATED: 'settings:updated',

  // Generic
  REQUEST: 'request',
  RESPONSE: 'response',
  EVENT: 'event',
  ERROR: 'error',
};

// Generate unique message IDs
let messageId = 0;
export function createMessageId() {
  return `msg_${++messageId}_${Date.now()}`;
}

// Message factory
export function createMessage(type, payload = {}, id = null) {
  return {
    id: id || createMessageId(),
    type,
    payload,
    timestamp: Date.now(),
  };
}

// Request/Response helper
export function createRequest(type, payload) {
  return createMessage(type, payload, `req_${createMessageId()}`);
}

export function createResponse(requestId, type, payload, error = null) {
  return {
    id: `res_${requestId}`,
    type,
    requestId,
    payload,
    error,
    timestamp: Date.now(),
  };
}
