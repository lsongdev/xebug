import { MessageTypes } from '../../protocol/index.js';

export class NetworkView {
  static css() {
    return `
.nv { flex:1; overflow:auto; padding:0; display:flex; }
.nv-table { flex:1; overflow:auto; }
.nv table { width:100%; border-collapse:collapse; font-size:11px; font-family:Menlo,Consolas,monospace; }
.nv thead { position:sticky; top:0; z-index:1; }
.nv th { background:#2d2d2d; color:#808080; padding:6px 10px; text-align:left; border-bottom:1px solid #3c3c3c; font-weight:500; }
.nv td { padding:4px 10px; border-bottom:1px solid #2a2a2a; color:#ccc; }
.nv tr:hover td { background:#2a2d2e; }
.nv tr.selected td { background:#094771; }
.nb { display:inline-block; padding:1px 6px; border-radius:3px; font-size:10px; }
.nb.ok { background:rgba(86,156,214,.15); color:#569cd6; }
.nb.err { background:rgba(244,135,113,.15); color:#f48771; }
.nv-detail { width:300px; border-left:1px solid #3c3c3c; overflow:auto; background:#1e1e1e; display:none; }
.nv-detail.active { display:block; }
.nv-detail-header { padding:12px; border-bottom:1px solid #3c3c3c; position:relative; }
.nv-detail-close { position:absolute; right:8px; top:8px; color:#ccc; cursor:pointer; font-size:18px; line-height:1; }
.nv-detail-close:hover { color:#f48771; }
.nv-detail-section { padding:12px; border-bottom:1px solid #2a2a2a; }
.nv-detail-section h4 { color:#569cd6; margin:0 0 8px 0; font-size:11px; font-weight:bold; }
.nv-detail-row { display:flex; justify-content:space-between; padding:3px 0; font-size:10px; }
.nv-detail-row .key { color:#9cdcfe; }
.nv-detail-row .value { color:#ce9178; max-width:250px; overflow:hidden; text-overflow:ellipsis; }
.nv-detail-body { padding:8px; font-size:10px; color:#ccc; white-space:pre-wrap; word-break:break-all; max-height:300px; overflow:auto; background:#252526; border-radius:3px; }
.nv-tabs { display:flex; border-bottom:1px solid #3c3c3c; }
.nv-tab { padding:8px 16px; color:#808080; cursor:pointer; border-bottom:2px solid transparent; }
.nv-tab:hover { color:#ccc; }
.nv-tab.active { color:#4fc1ff; border-bottom-color:#4fc1ff; }
`;
  }
  get id() { return 'network'; }
  get label() { return 'Network'; }

  render(container, transport) {
    this.container = container;
    this.transport = transport;
    this.entries = new Map();
    this._built = false;
    this.selectedEntry = null;
    this.currentTab = 'response';
    container.innerHTML = `
      <div class="nv">
        <div class="nv-table"><div class="emp">No network requests</div></div>
        <div class="nv-detail"></div>
      </div>`;
    this.netContainer = container.querySelector('.nv-table');
    this.detailContainer = container.querySelector('.nv-detail');
  }

  onActivate() {}
  onDeactivate() {}

  wireTransport(transport) {
    this.transport = transport;
    transport.on(MessageTypes.NETWORK_ENTRY_ADDED, msg => this._netRow(msg.payload.entry));
    transport.on(MessageTypes.NETWORK_ENTRIES_RESPONSE, msg => {
      if (this._built) {
        const tbody = this.netContainer.querySelector('tbody');
        if (tbody) tbody.innerHTML = '';
      }
      for (const entry of msg.payload.entries) this._netRow(entry);
    });
    transport.on(MessageTypes.NETWORK_ENTRY_DETAILS_RESPONSE, msg => {
      if (msg.payload.entry) {
        this._renderDetail(msg.payload.entry);
      }
    });
    
    // Tab click handler using event delegation
    this.container.addEventListener('click', (e) => {
      if (e.target.classList.contains('nv-tab')) {
        const tab = e.target.dataset.tab;
        this._switchTab(tab);
      }
    });
  }

  _switchTab(tabName) {
    this.currentTab = tabName;
    
    // Update tab active states
    const tabs = this.detailContainer.querySelectorAll('.nv-tab');
    tabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    // Show/hide tab content
    const contents = this.detailContainer.querySelectorAll('.tab-content');
    contents.forEach(content => {
      content.style.display = content.dataset.tabContent === tabName ? 'block' : 'none';
    });
  }

  get _netBody() {
    let tb = this.netContainer.querySelector('table tbody');
    if (!tb) {
      this.netContainer.innerHTML = `<table><thead><tr><th>Method</th><th>URL</th><th>Status</th><th>Size</th><th>Time</th></tr></thead><tbody></tbody></table>`;
      tb = this.netContainer.querySelector('tbody');
      const emp = this.netContainer.querySelector('.emp');
      if (emp) emp.style.display = 'none';
      this._built = true;
    }
    return tb;
  }

  _netRow(e) {
    const tb = this._netBody;
    this.entries.set(e.id, e);
    let row = tb.querySelector(`tr[data-id="${e.id}"]`);
    if (!row) {
      row = document.createElement('tr');
      row.dataset.id = e.id;
      row.onclick = () => this._selectEntry(e.id, row);
      tb.appendChild(row);
    }
    const cls = e.status >= 200 && e.status < 300 ? 'ok' : 'err';
    row.innerHTML = `
      <td style="color:#808080">${e.method || 'GET'}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${e.url}">${e.url}</td>
      <td><span class="nb ${cls}">${e.status || '…'}</span></td>
      <td>${e.size ? this._fb(e.size) : '-'}</td>
      <td>${e.duration ? e.duration + 'ms' : '-'}</td>`;
  }

  _selectEntry(entryId, row) {
    // Remove previous selection
    const prev = this.netContainer.querySelector('tr.selected');
    if (prev) prev.classList.remove('selected');
    
    // Add selection
    row.classList.add('selected');
    this.selectedEntry = entryId;
    
    // Request detailed entry data
    this.transport.send({
      type: MessageTypes.NETWORK_GET_ENTRY_DETAILS,
      payload: { entryId }
    });
  }

  _renderDetail(entry) {
    this.detailContainer.classList.add('active');
    this.currentTab = 'response';
    
    const hasRequestBody = entry.requestBody && entry.requestBody !== '[Binary Data]';
    const hasResponseBody = entry.responseBody && entry.responseBody !== '[Binary Data]';
    
    let html = `
      <div class="nv-detail-header">
        <span class="nv-detail-close">×</span>
        <div style="color:#569cd6; font-size:11px; font-weight:bold; margin-bottom:4px; word-break: break-all;">${entry.method} ${entry.url}</div>
        <div style="color:#808080; font-size:10px;">Status: ${entry.status} ${entry.statusText}</div>
      </div>
      
      <div class="nv-tabs">
        <div class="nv-tab ${hasRequestBody ? 'active' : ''}" data-tab="request">Request</div>
        <div class="nv-tab ${hasResponseBody ? 'active' : ''}" data-tab="response">Response</div>
      </div>
    `;
    
    // Request tab
    html += `<div class="tab-content" data-tab-content="request" style="display:${hasRequestBody ? 'block' : 'none'}">`;
    if (hasRequestBody) {
      html += `<div class="nv-detail-section">
        <h4>Headers</h4>`;
      if (entry.requestHeaders) {
        const headers = typeof entry.requestHeaders === 'object' ? Object.entries(entry.requestHeaders) : [];
        for (const [key, value] of headers) {
          html += `<div class="nv-detail-row">
            <span class="key">${key}:</span>
            <span class="value">${value}</span>
          </div>`;
        }
      }
      html += `</div>
      <div class="nv-detail-section">
        <h4>Body</h4>
        <div class="nv-detail-body">${this._escapeHtml(entry.requestBody)}</div>
      </div>`;
    } else {
      html += `<div class="nv-detail-section"><p style="color:#808080; font-size:10px;">No request body</p></div>`;
    }
    html += `</div>`;
    
    // Response tab
    html += `<div class="tab-content" data-tab-content="response" style="display:${hasResponseBody ? 'block' : 'none'}">`;
    if (hasResponseBody) {
      html += `<div class="nv-detail-section">
        <h4>Headers</h4>`;
      if (entry.responseHeaders) {
        const headers = typeof entry.responseHeaders === 'object' ? Object.entries(entry.responseHeaders) : [];
        for (const [key, value] of headers) {
          html += `<div class="nv-detail-row">
            <span class="key">${key}:</span>
            <span class="value">${value}</span>
          </div>`;
        }
      }
      html += `</div>
      <div class="nv-detail-section">
        <h4>Body</h4>
        <div class="nv-detail-body">${this._escapeHtml(entry.responseBody)}</div>
      </div>`;
    } else {
      html += `<div class="nv-detail-section"><p style="color:#808080; font-size:10px;">No response body</p></div>`;
    }
    html += `</div>`;
    
    this.detailContainer.innerHTML = html;
    
    // Add close button handler
    const closeBtn = this.detailContainer.querySelector('.nv-detail-close');
    if (closeBtn) {
      closeBtn.onclick = () => {
        this.detailContainer.classList.remove('active');
        this.detailContainer.innerHTML = '';
        const selectedRow = this.netContainer.querySelector('tr.selected');
        if (selectedRow) selectedRow.classList.remove('selected');
      };
    }
  }

  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  _fb(b) { return b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(1) + ' KB' : (b / 1048576).toFixed(1) + ' MB'; }
}
