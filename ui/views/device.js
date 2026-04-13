import { MessageTypes, createRequest } from '../../protocol/index.js';

export class DeviceView {
  static css() {
    return `
.dv { flex:1; overflow:auto; padding:8px; display:flex; flex-direction:column; gap:8px; }

/* Info rows */
.irow { display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #2a2a2a; }
.irow:last-child { border-bottom:none; }
.irow-label { color:#808080; }
.irow-value { color:#ccc; font-weight:500; max-width:60%; word-break:break-all; }

/* Screen grid */
.scr-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.scr-item { }
.scr-label { font-size:10px; color:#808080; margin-bottom:2px; }
.scr-value { font-size:12px; color:#4fc1ff; }

/* Feature badges */
.feat-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(120px, 1fr)); gap:6px; }
.feat-badge { padding:6px 8px; border-radius:3px; font-size:11px; display:flex; align-items:center; gap:4px; }
.feat-badge.on { background:rgba(106,153,85,.15); color:#6a9955; }
.feat-badge.off { background:rgba(244,135,113,.1); color:#808080; }
.feat-icon { font-size:12px; }

/* Network status */
.net-status { display:flex; gap:12px; flex-wrap:wrap; }
.net-item { padding:6px 12px; background:#2a2a2a; border-radius:4px; }
.net-label { font-size:10px; color:#808080; }
.net-val { font-size:12px; color:#ccc; }
.net-val.online { color:#6a9955; }
.net-val.offline { color:#f48771; }

/* Refresh button */

/* User agent */
.ua-text { font-size:10px; color:#808080; word-break:break-all; line-height:1.4; }
`;
  }
  
  get id() { return 'device'; }
  get label() { return 'Device'; }

  constructor() {
    this.deviceInfo = null;
  }

  render(container, transport) {
    this.container = container;
    this.transport = transport;
    
    container.innerHTML = `
      <div class="dv">
        <div class="dsec">
          <div class="dsec-hdr">
            <h3>Platform</h3>
            <button class="refresh" title="Refresh">↻</button>
          </div>
          <div class="dsec-body" id="platform-body"></div>
        </div>

        <div class="dsec">
          <div class="dsec-hdr">
            <h3>Screen & Viewport</h3>
          </div>
          <div class="dsec-body">
            <div class="scr-grid" id="screen-grid"></div>
          </div>
        </div>

        <div class="dsec">
          <div class="dsec-hdr">
            <h3>Network</h3>
          </div>
          <div class="dsec-body">
            <div class="net-status" id="net-status"></div>
          </div>
        </div>

        <div class="dsec">
          <div class="dsec-hdr">
            <h3>Features</h3>
          </div>
          <div class="dsec-body">
            <div class="feat-grid" id="feat-grid"></div>
          </div>
        </div>

        <div class="dsec">
          <div class="dsec-hdr">
            <h3>User Agent</h3>
          </div>
          <div class="dsec-body">
            <div class="ua-text" id="ua-text"></div>
          </div>
        </div>
      </div>`;

    // Refresh button
    container.querySelector('.refresh').addEventListener('click', () => this._refreshInfo());
  }

  onActivate() {
    this._refreshInfo();
  }

  onDeactivate() {}

  wireTransport(transport) {
    this.transport = transport;
    
    transport.on(MessageTypes.DEVICE_INFO_RESPONSE, msg => {
      if (msg.payload) {
        this.deviceInfo = msg.payload;
        this._renderInfo(this.deviceInfo);
      }
    });
  }

  _refreshInfo() {
    this.transport.send(createRequest(MessageTypes.DEVICE_GET_INFO, {}));
  }

  _renderInfo(info) {
    this._renderPlatform(info.platform);
    this._renderScreen(info.screen, info.viewport);
    this._renderNetwork(info.network);
    this._renderFeatures(info.features);
    this._renderUserAgent(info.platform.userAgent);
  }

  _renderPlatform(platform) {
    const container = this.container.querySelector('#platform-body');
    if (!container || !platform) return;

    const formatMemory = (mem) => mem ? `${mem} GB` : 'N/A';

    const items = [
      { label: 'Platform', value: platform.platform },
      { label: 'Language', value: platform.language },
      { label: 'Languages', value: platform.languages?.join(', ') },
      { label: 'Touch Points', value: platform.maxTouchPoints },
      { label: 'CPU Cores', value: platform.hardwareConcurrency },
      { label: 'Device Memory', value: formatMemory(platform.deviceMemory) },
      { label: 'Cookies Enabled', value: platform.cookieEnabled ? 'Yes' : 'No' }
    ].filter(item => item.value !== null && item.value !== undefined && item.value !== '');

    container.innerHTML = items.map(item => `
      <div class="irow">
        <span class="irow-label">${item.label}</span>
        <span class="irow-value">${item.value}</span>
      </div>
    `).join('');
  }

  _renderScreen(screen, viewport) {
    const container = this.container.querySelector('#screen-grid');
    if (!container || !screen) return;

    const items = [
      { label: 'Screen Width', value: `${screen.width}px` },
      { label: 'Screen Height', value: `${screen.height}px` },
      { label: 'Available Width', value: `${screen.availWidth}px` },
      { label: 'Available Height', value: `${screen.availHeight}px` },
      { label: 'Color Depth', value: `${screen.colorDepth}-bit` },
      { label: 'Pixel Depth', value: `${screen.pixelDepth}-bit` },
      { label: 'Device Pixel Ratio', value: `${screen.devicePixelRatio}x` },
      { label: 'Orientation', value: screen.orientation },
      { label: 'Viewport Width', value: `${viewport?.width}px` },
      { label: 'Viewport Height', value: `${viewport?.height}px` }
    ];

    container.innerHTML = items.map(item => `
      <div class="scr-item">
        <div class="scr-label">${item.label}</div>
        <div class="scr-value">${item.value}</div>
      </div>
    `).join('');
  }

  _renderNetwork(network) {
    const container = this.container.querySelector('#net-status');
    if (!container || !network) return;

    const items = [
      { 
        label: 'Status', 
        value: network.online ? 'Online' : 'Offline', 
        cls: network.online ? 'online' : 'offline' 
      },
      { label: 'Downlink', value: network.downlink ? `${network.downlink} Mbps` : 'N/A' },
      { label: 'RTT', value: network.rtt ? `${network.rtt} ms` : 'N/A' },
      { label: 'Type', value: network.effectiveType || 'N/A' }
    ];

    container.innerHTML = items.map(item => `
      <div class="net-item">
        <div class="net-label">${item.label}</div>
        <div class="net-val ${item.cls || ''}">${item.value}</div>
      </div>
    `).join('');
  }

  _renderFeatures(features) {
    const container = this.container.querySelector('#feat-grid');
    if (!container || !features) return;

    const badges = Object.entries(features).map(([key, value]) => ({
      name: key.replace(/([A-Z])/g, '$1').replace(/^./, s => s.toUpperCase()),
      enabled: value
    }));

    container.innerHTML = badges.map(badge => `
      <div class="feat-badge ${badge.enabled ? 'on' : 'off'}">
        <span class="feat-icon">${badge.enabled ? '✓' : '✕'}</span>
        ${badge.name}
      </div>
    `).join('');
  }

  _renderUserAgent(userAgent) {
    const container = this.container.querySelector('#ua-text');
    if (container && userAgent) {
      container.textContent = userAgent;
    }
  }
}
