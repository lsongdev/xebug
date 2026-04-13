const CHANNEL_NAME = 'xebug_protocol';

// Local transport using BroadcastChannel
export class LocalTransport {
  constructor() {
    this.channel = null;
    this.handlers = new Map();
    this.isConnected = false;
  }

  // Initialize as UI side (sender)
  initAsUI() {
    this.channel = new BroadcastChannel(CHANNEL_NAME);
    this.channel.onmessage = (event) => this._handleMessage(event.data);
    this.isConnected = true;
  }

  // Initialize as Agent side (receiver)
  initAsAgent() {
    this.channel = new BroadcastChannel(CHANNEL_NAME);
    this.channel.onmessage = (event) => this._handleMessage(event.data);
    this.isConnected = true;
  }

  // Send message
  send(message) {
    if (!this.isConnected) {
      console.error('[Transport] Not connected');
      return;
    }
    this.channel.postMessage(message);
  }

  // Register handler for message type
  on(type, handler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type).push(handler);
  }

  // Remove handler
  off(type, handler) {
    const handlers = this.handlers.get(type);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) handlers.splice(index, 1);
    }
  }

  // Clear all handlers
  clearHandlers() {
    this.handlers.clear();
  }

  // Disconnect
  disconnect() {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
    this.isConnected = false;
    this.clearHandlers();
  }

  // Internal message handler
  _handleMessage(message) {
    const handlers = this.handlers.get(message.type);
    if (handlers) {
      for (const handler of handlers) {
        handler(message);
      }
    }
    // Also call generic handler
    const genericHandlers = this.handlers.get('*');
    if (genericHandlers) {
      for (const handler of genericHandlers) {
        handler(message);
      }
    }
  }
}
/*
// Fallback transport using localStorage events (for cross-origin iframes)
export class StorageTransport {
  constructor() {
    this.handlers = new Map();
    this.isConnected = false;
    this.storageKey = 'xebug_messages';
  }

  initAsUI() {
    window.addEventListener('storage', (e) => this._handleStorage(e));
    this.isConnected = true;
  }

  initAsAgent() {
    window.addEventListener('storage', (e) => this._handleStorage(e));
    this.isConnected = true;
  }

  send(message) {
    if (!this.isConnected) return;
    const data = JSON.stringify(message);
    localStorage.setItem(this.storageKey, data);
    // Trigger storage event on other tabs
    localStorage.setItem(this.storageKey + '_ts', Date.now().toString());
  }

  on(type, handler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type).push(handler);
  }

  off(type, handler) {
    const handlers = this.handlers.get(type);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) handlers.splice(index, 1);
    }
  }

  clearHandlers() {
    this.handlers.clear();
  }

  disconnect() {
    window.removeEventListener('storage', this._handleStorage.bind(this));
    this.isConnected = false;
    this.clearHandlers();
  }

  _handleStorage(event) {
    if (event.key !== this.storageKey && event.key !== this.storageKey + '_ts') return;
    if (!event.newValue) return;

    try {
      const message = JSON.parse(event.newValue);
      const handlers = this.handlers.get(message.type);
      if (handlers) {
        for (const handler of handlers) {
          handler(message);
        }
      }
    } catch (e) {
      console.error('[StorageTransport] Parse error:', e);
    }
  }
}

*/