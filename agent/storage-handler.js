import { MessageTypes, createResponse, createMessage } from '../protocol/index.js';

// Storage handler for localStorage, sessionStorage, cookies
export class StorageHandler {
  constructor(transport) {
    this.transport = transport;
    this._registerHandlers();
  }

  _registerHandlers() {
    this.transport.on(MessageTypes.STORAGE_GET_LOCAL, (msg) => this._handleLocalStorage(msg));
    this.transport.on(MessageTypes.STORAGE_GET_SESSION, (msg) => this._handleSessionStorage(msg));
    this.transport.on(MessageTypes.STORAGE_GET_COOKIES, (msg) => this._handleCookies(msg));
    this.transport.on(MessageTypes.STORAGE_DELETE, (msg) => this._handleDelete(msg));
    this.transport.on(MessageTypes.STORAGE_CLEAR, (msg) => this._handleClear(msg));
  }

  _handleLocalStorage(msg) {
    try {
      const items = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        items.push({ key, value: localStorage.getItem(key) });
      }
      this.transport.send(createResponse(msg.id, MessageTypes.STORAGE_RESPONSE, { items, type: 'local' }));
    } catch (error) {
      this.transport.send(createResponse(msg.id, MessageTypes.STORAGE_RESPONSE, null, error.message));
    }
  }

  _handleSessionStorage(msg) {
    try {
      const items = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        items.push({ key, value: sessionStorage.getItem(key) });
      }
      this.transport.send(createResponse(msg.id, MessageTypes.STORAGE_RESPONSE, { items, type: 'session' }));
    } catch (error) {
      this.transport.send(createResponse(msg.id, MessageTypes.STORAGE_RESPONSE, null, error.message));
    }
  }

  async _handleCookies(msg) {
    try {
      const cookies = document.cookie.split(';').map(pair => {
        const [name, ...valueParts] = pair.split('=');
        return {
          name: name.trim(),
          value: valueParts.join('=').trim(),
        };
      }).filter(c => c.name);

      this.transport.send(createResponse(msg.id, MessageTypes.STORAGE_RESPONSE, { cookies, type: 'cookies' }));
    } catch (error) {
      this.transport.send(createResponse(msg.id, MessageTypes.STORAGE_RESPONSE, null, error.message));
    }
  }

  _handleDelete(msg) {
    const { type, key } = msg.payload;
    try {
      if (type === 'local') {
        localStorage.removeItem(key);
      } else if (type === 'session') {
        sessionStorage.removeItem(key);
      } else if (type === 'cookies') {
        document.cookie = key + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
      }
      this.transport.send(createMessage(MessageTypes.STORAGE_DELETED, { type, key }));
    } catch (error) {
      this.transport.send(createMessage(MessageTypes.STORAGE_DELETED, { type, key, error: error.message }));
    }
  }

  _handleClear(msg) {
    const { type } = msg.payload;
    try {
      if (type === 'local') {
        localStorage.clear();
      } else if (type === 'session') {
        sessionStorage.clear();
      } else if (type === 'cookies') {
        document.cookie.split(';').forEach(c => {
          const name = c.split('=')[0].trim();
          document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
        });
      }
      this.transport.send(createMessage(MessageTypes.STORAGE_DELETED, { type }));
    } catch (error) {
      this.transport.send(createMessage(MessageTypes.STORAGE_DELETED, { type, error: error.message }));
    }
  }
}
