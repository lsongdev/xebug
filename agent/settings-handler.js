import { MessageTypes, createResponse } from '../protocol/index.js';

// Settings handler - manages xebug configuration
export class SettingsHandler {
  constructor(transport) {
    this.transport = transport;
    this.settingsKey = '__xebug_settings__';
    
    // Default settings
    this.defaults = {
      // Panel settings
      panels: {
        dom: { enabled: true },
        network: { enabled: true },
        storage: { enabled: true },
        console: { enabled: true },
        perf: { enabled: true },
        device: { enabled: true },
        settings: { enabled: true }
      },
      
      // Network settings
      network: {
        maxEntries: 100,
        captureBodies: true,
        captureHeaders: true,
        maxSizeKB: 100
      },
      
      // Console settings
      console: {
        preserveLog: false,
        showTimestamps: false,
        maxMessages: 1000
      },
      
      // Performance settings
      perf: {
        autoRefresh: true,
        refreshInterval: 2000,
        showMemory: true,
        showLongTasks: true
      },
      
      // UI settings
      ui: {
        theme: 'dark',
        fontSize: 11,
        panelPosition: 'docked', // 'docked' or 'floating'
        panelSize: { width: '90%', height: '50%' }
      }
    };

    this._onGet = this._onGet.bind(this);
    this._onUpdate = this._onUpdate.bind(this);

    this.transport.on(MessageTypes.SETTINGS_GET, this._onGet);
    this.transport.on(MessageTypes.SETTINGS_UPDATE, this._onUpdate);
  }

  destroy() {
    this.transport.off(MessageTypes.SETTINGS_GET, this._onGet);
    this.transport.off(MessageTypes.SETTINGS_UPDATE, this._onUpdate);
  }

  _onGet() {
    const settings = this._loadSettings();
    const response = createResponse(
      'settings_get',
      MessageTypes.SETTINGS_RESPONSE,
      { settings }
    );
    this.transport.send(response);
  }

  _onUpdate(msg) {
    const updates = msg.payload?.updates;
    if (!updates) return;

    const currentSettings = this._loadSettings();
    const mergedSettings = this._deepMerge(currentSettings, updates);
    this._saveSettings(mergedSettings);

    // Notify UI of successful update
    const response = createResponse(
      'settings_update',
      MessageTypes.SETTINGS_UPDATED,
      { settings: mergedSettings }
    );
    this.transport.send(response);
  }

  _loadSettings() {
    try {
      const stored = localStorage.getItem(this.settingsKey);
      if (stored) {
        return this._deepMerge(this.defaults, JSON.parse(stored));
      }
    } catch (e) {
      console.warn('[Xebug Settings] Failed to load settings:', e);
    }
    return JSON.parse(JSON.stringify(this.defaults));
  }

  _saveSettings(settings) {
    try {
      localStorage.setItem(this.settingsKey, JSON.stringify(settings));
    } catch (e) {
      console.warn('[Xebug Settings] Failed to save settings:', e);
    }
  }

  _deepMerge(target, source) {
    const result = JSON.parse(JSON.stringify(target));
    
    for (const key of Object.keys(source)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!result[key]) {
          result[key] = {};
        }
        result[key] = this._deepMerge(result[key], source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  // Helper to get a specific setting value
  get(path, defaultValue = null) {
    const settings = this._loadSettings();
    const parts = path.split('.');
    let current = settings;
    
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return defaultValue;
      }
    }
    
    return current;
  }
}
