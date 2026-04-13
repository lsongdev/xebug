import { MessageTypes, createRequest } from '../../protocol/index.js';

export class SettingsView {
  static css() {
    return `
.sv { flex:1; overflow:auto; padding:8px; display:flex; flex-direction:column; gap:8px; }

/* Setting rows */
.srow { display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid #2a2a2a; }
.srow:last-child { border-bottom:none; }
.srow-info { flex:1; }
.srow-label { color:#ccc; font-size:12px; }
.srow-desc { color:#808080; font-size:10px; margin-top:2px; }

/* Toggle switch */
.toggle { position:relative; width:40px; height:20px; cursor:pointer; }
.toggle input { opacity:0; width:0; height:0; }
.toggle-slider { position:absolute; top:0; left:0; right:0; bottom:0; background:#3c3c3c; border-radius:10px; transition:0.2s; }
.toggle-slider::before { content:''; position:absolute; width:16px; height:16px; left:2px; top:2px; background:#ccc; border-radius:50%; transition:0.2s; }
.toggle input:checked + .toggle-slider { background:#4a9eff; }
.toggle input:checked + .toggle-slider::before { transform:translateX(20px); }

/* Select dropdown */
.sselect { background:#2a2a2a; border:1px solid #3c3c3c; color:#ccc; padding:4px 8px; border-radius:3px; font-size:11px; font-family:inherit; outline:none; cursor:pointer; }
.sselect:focus { border-color:#4a9eff; }

/* Number input */
.snumber { background:#2a2a2a; border:1px solid #3c3c3c; color:#ccc; padding:4px 8px; border-radius:3px; font-size:11px; font-family:inherit; outline:none; width:80px; }
.snumber:focus { border-color:#4a9eff; }

/* Save indicator */
.save-indicator { position:fixed; bottom:20px; right:20px; padding:8px 16px; background:#2d2d2d; border:1px solid #3c3c3c; border-radius:4px; color:#6a9955; font-size:11px; opacity:0; transition:opacity 0.2s; pointer-events:none; }
.save-indicator.show { opacity:1; }

/* Reset button */
.reset-btn { background:#3c3c3c; border:none; color:#ccc; padding:8px 16px; border-radius:4px; cursor:pointer; font-size:11px; font-family:inherit; }
.reset-btn:hover { background:#4a4a4a; }

/* Panel toggles grid */
.panel-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(150px, 1fr)); gap:8px; }
.panel-item { display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:#2a2a2a; border-radius:4px; }
.panel-name { color:#ccc; font-size:11px; }
`;
  }
  
  get id() { return 'settings'; }
  get label() { return 'Settings'; }

  constructor() {
    this.settings = null;
  }

  render(container, transport) {
    this.container = container;
    this.transport = transport;
    
    container.innerHTML = `
      <div class="sv">
        <div class="dsec" style="padding:8px 12px; display:flex; justify-content:flex-end;">
          <button class="reset-btn" id="reset-settings">Reset to Defaults</button>
        </div>

        <div class="ssec">
          <div class="ssec-hdr">
            <h3>Panels</h3>
          </div>
          <div class="ssec-body">
            <div class="panel-grid" id="panel-grid"></div>
          </div>
        </div>

        <div class="ssec">
          <div class="ssec-hdr">
            <h3>Network</h3>
          </div>
          <div class="ssec-body" id="network-settings"></div>
        </div>

        <div class="ssec">
          <div class="ssec-hdr">
            <h3>Console</h3>
          </div>
          <div class="ssec-body" id="console-settings"></div>
        </div>

        <div class="ssec">
          <div class="ssec-hdr">
            <h3>Performance</h3>
          </div>
          <div class="ssec-body" id="perf-settings"></div>
        </div>

        <div class="ssec">
          <div class="ssec-hdr">
            <h3>UI</h3>
          </div>
          <div class="ssec-body" id="ui-settings"></div>
        </div>
      </div>
      <div class="save-indicator" id="save-indicator">✓ Settings saved</div>`;

    // Reset button
    container.querySelector('#reset-settings').addEventListener('click', () => this._resetSettings());
  }

  onActivate() {
    this._loadSettings();
  }

  onDeactivate() {}

  wireTransport(transport) {
    this.transport = transport;
    
    transport.on(MessageTypes.SETTINGS_RESPONSE, msg => {
      if (msg.payload?.settings) {
        this.settings = msg.payload.settings;
        this._renderSettings(this.settings);
      }
    });

    transport.on(MessageTypes.SETTINGS_UPDATED, msg => {
      if (msg.payload?.settings) {
        this.settings = msg.payload.settings;
        this._showSaveIndicator();
      }
    });
  }

  _loadSettings() {
    this.transport.send(createRequest(MessageTypes.SETTINGS_GET, {}));
  }

  _resetSettings() {
    this.transport.send(createRequest(MessageTypes.SETTINGS_UPDATE, { 
      updates: {} 
    }));
    setTimeout(() => this._loadSettings(), 100);
  }

  _updateSetting(path, value) {
    const keys = path.split('.');
    const updates = {};
    let current = updates;
    
    for (let i = 0; i < keys.length - 1; i++) {
      current[keys[i]] = {};
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
    
    this.transport.send(createRequest(MessageTypes.SETTINGS_UPDATE, { updates }));
  }

  _showSaveIndicator() {
    const indicator = this.container.querySelector('#save-indicator');
    if (indicator) {
      indicator.classList.add('show');
      setTimeout(() => indicator.classList.remove('show'), 1500);
    }
  }

  _renderSettings(settings) {
    this._renderPanelGrid(settings.panels);
    this._renderNetworkSettings(settings.network);
    this._renderConsoleSettings(settings.console);
    this._renderPerfSettings(settings.perf);
    this._renderUISettings(settings.ui);
  }

  _renderPanelGrid(panels) {
    const container = this.container.querySelector('#panel-grid');
    if (!container || !panels) return;

    const panelNames = {
      dom: 'Elements',
      network: 'Network',
      storage: 'Storage',
      console: 'Console',
      perf: 'Performance',
      device: 'Device',
      settings: 'Settings'
    };

    container.innerHTML = Object.entries(panels).map(([key, panel]) => `
      <div class="panel-item">
        <span class="panel-name">${panelNames[key] || key}</span>
        <label class="toggle">
          <input type="checkbox" ${panel.enabled ? 'checked' : ''} 
            data-path="panels.${key}.enabled">
          <span class="toggle-slider"></span>
        </label>
      </div>
    `).join('');

    // Bind events
    container.querySelectorAll('input[type="checkbox"]').forEach(input => {
      input.addEventListener('change', e => {
        this._updateSetting(e.target.dataset.path, e.target.checked);
      });
    });
  }

  _renderNetworkSettings(network) {
    const container = this.container.querySelector('#network-settings');
    if (!container || !network) return;

    const items = [
      { 
        label: 'Max Entries', 
        desc: 'Maximum number of network entries to store',
        type: 'number', 
        path: 'network.maxEntries', 
        value: network.maxEntries 
      },
      { 
        label: 'Capture Bodies', 
        desc: 'Capture request and response bodies',
        type: 'toggle', 
        path: 'network.captureBodies', 
        value: network.captureBodies 
      },
      { 
        label: 'Capture Headers', 
        desc: 'Capture request and response headers',
        type: 'toggle', 
        path: 'network.captureHeaders', 
        value: network.captureHeaders 
      },
      { 
        label: 'Max Size (KB)', 
        desc: 'Maximum body size to capture per request',
        type: 'number', 
        path: 'network.maxSizeKB', 
        value: network.maxSizeKB 
      }
    ];

    container.innerHTML = this._renderSettingRows(items);
    this._bindEvents(container);
  }

  _renderConsoleSettings(console) {
    const container = this.container.querySelector('#console-settings');
    if (!container || !console) return;

    const items = [
      { 
        label: 'Preserve Log', 
        desc: 'Keep console logs across navigations',
        type: 'toggle', 
        path: 'console.preserveLog', 
        value: console.preserveLog 
      },
      { 
        label: 'Show Timestamps', 
        desc: 'Show timestamps on console messages',
        type: 'toggle', 
        path: 'console.showTimestamps', 
        value: console.showTimestamps 
      },
      { 
        label: 'Max Messages', 
        desc: 'Maximum number of console messages to store',
        type: 'number', 
        path: 'console.maxMessages', 
        value: console.maxMessages 
      }
    ];

    container.innerHTML = this._renderSettingRows(items);
    this._bindEvents(container);
  }

  _renderPerfSettings(perf) {
    const container = this.container.querySelector('#perf-settings');
    if (!container || !perf) return;

    const items = [
      { 
        label: 'Auto Refresh', 
        desc: 'Automatically refresh performance metrics',
        type: 'toggle', 
        path: 'perf.autoRefresh', 
        value: perf.autoRefresh 
      },
      { 
        label: 'Refresh Interval', 
        desc: 'How often to refresh (milliseconds)',
        type: 'number', 
        path: 'perf.refreshInterval', 
        value: perf.refreshInterval 
      },
      { 
        label: 'Show Memory', 
        desc: 'Display memory usage in performance panel',
        type: 'toggle', 
        path: 'perf.showMemory', 
        value: perf.showMemory 
      },
      { 
        label: 'Show Long Tasks', 
        desc: 'Display long tasks in performance panel',
        type: 'toggle', 
        path: 'perf.showLongTasks', 
        value: perf.showLongTasks 
      }
    ];

    container.innerHTML = this._renderSettingRows(items);
    this._bindEvents(container);
  }

  _renderUISettings(ui) {
    const container = this.container.querySelector('#ui-settings');
    if (!container || !ui) return;

    container.innerHTML = `
      <div class="srow">
        <div class="srow-info">
          <div class="srow-label">Font Size</div>
          <div class="srow-desc">Panel font size in pixels</div>
        </div>
        <input type="number" class="snumber" value="${ui.fontSize}" min="9" max="16" 
          data-path="ui.fontSize">
      </div>
      <div class="srow">
        <div class="srow-info">
          <div class="srow-label">Panel Position</div>
          <div class="srow-desc">Default panel position on open</div>
        </div>
        <select class="sselect" data-path="ui.panelPosition">
          <option value="docked" ${ui.panelPosition === 'docked' ? 'selected' : ''}>Docked (Bottom)</option>
          <option value="floating" ${ui.panelPosition === 'floating' ? 'selected' : ''}>Floating</option>
        </select>
      </div>
    `;

    this._bindEvents(container);
  }

  _renderSettingRows(items) {
    return items.map(item => {
      if (item.type === 'toggle') {
        return `
          <div class="srow">
            <div class="srow-info">
              <div class="srow-label">${item.label}</div>
              <div class="srow-desc">${item.desc}</div>
            </div>
            <label class="toggle">
              <input type="checkbox" ${item.value ? 'checked' : ''} data-path="${item.path}">
              <span class="toggle-slider"></span>
            </label>
          </div>`;
      } else if (item.type === 'number') {
        return `
          <div class="srow">
            <div class="srow-info">
              <div class="srow-label">${item.label}</div>
              <div class="srow-desc">${item.desc}</div>
            </div>
            <input type="number" class="snumber" value="${item.value}" data-path="${item.path}">
          </div>`;
      }
      return '';
    }).join('');
  }

  _bindEvents(container) {
    container.querySelectorAll('input[type="checkbox"]').forEach(input => {
      input.addEventListener('change', e => {
        this._updateSetting(e.target.dataset.path, e.target.checked);
      });
    });

    container.querySelectorAll('input[type="number"], select').forEach(input => {
      input.addEventListener('change', e => {
        let value = e.target.value;
        if (e.target.type === 'number') {
          value = parseInt(value, 10);
        }
        this._updateSetting(e.target.dataset.path, value);
      });
    });
  }
}
