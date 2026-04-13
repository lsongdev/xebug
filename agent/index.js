import { LocalTransport, MessageTypes, createMessage } from '../protocol/index.js';
import { DOMHandler } from './dom-handler.js';
import { NetworkHandler } from './network-handler.js';
import { StorageHandler } from './storage-handler.js';
import { ConsoleHandler } from './console-handler.js';
import { PerformanceHandler } from './perf-handler.js';
import { DeviceHandler } from './device-handler.js';
import { SettingsHandler } from './settings-handler.js';

// Main agent class - manages connection and all handlers
export class Agent {
  constructor() {
    this.transport = null;
    this.handlers = {};
    this.isConnected = false;
  }

  // Connect to UI panel
  connect() {
    if (this.isConnected) return;

    this.transport = new LocalTransport();
    this.transport.initAsAgent();

    // Initialize all handlers
    this.handlers.dom = new DOMHandler(this.transport);
    this.handlers.network = new NetworkHandler(this.transport);
    this.handlers.storage = new StorageHandler(this.transport);
    this.handlers.console = new ConsoleHandler(this.transport);
    this.handlers.perf = new PerformanceHandler(this.transport);
    this.handlers.device = new DeviceHandler(this.transport);
    this.handlers.settings = new SettingsHandler(this.transport);

    // Send connected message
    this.transport.send(createMessage(MessageTypes.CONNECTED));
    this.isConnected = true;

    // console.log('[Xebug Agent] Connected to UI panel');
  }

  // Disconnect from UI panel
  disconnect() {
    if (!this.isConnected) return;

    // Destroy all handlers
    Object.values(this.handlers).forEach(handler => {
      if (handler.destroy) handler.destroy();
    });

    this.transport.disconnect();
    this.handlers = {};
    this.isConnected = false;

    console.log('[Xebug Agent] Disconnected from UI panel');
  }

  // Get transport for custom handlers
  getTransport() {
    return this.transport;
  }
}
