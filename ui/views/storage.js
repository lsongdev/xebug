import { MessageTypes, createRequest } from '../../protocol/index.js';

export class StorageView {
  static css() {
    return `
.sv { flex:1; overflow:auto; padding:8px; }
.ss { margin-bottom:16px; }
.sh { display:flex; align-items:center; gap:8px; margin-bottom:6px; padding-bottom:4px; border-bottom:1px solid #3c3c3c; }
.sh h3 { flex:1; color:#ccc; font-size:12px; margin:0; }
.sh .abtn { display:flex; gap:4px; }
.sh .abtn button { background:#3c3c3c; color:#ccc; border:none; padding:3px 10px; border-radius:3px; font-size:11px; cursor:pointer; }
.sh .abtn button:hover { background:#4a9eff; }
.st { width:100%; border-collapse:collapse; font-size:11px; }
.st td { 
  padding:4px 10px; 
  border-bottom:1px solid #2a2a2a; 
  vertical-align:top; 
  max-width: 100px;
  overflow: hidden;
  word-wrap: break-word;
  text-overflow: ellipsis;
}
.st td:first-child { color:#4fc1ff; font-weight:500; white-space:nowrap; width:30%; max-width:150px; overflow:hidden; text-overflow:ellipsis; }
.st td:last-child { color:#ccc; word-break:break-all; }
.st .del-row { cursor:pointer; color:#f48771; text-align:center; font-size:14px; }
.st .del-row:hover { background:rgba(244,135,113,.15); }
.st th { background:transparent; padding:2px 8px; text-align:left; font-size:10px; color:#808080; border-bottom:1px solid #3c3c3c; }
`;
  }
  get id() { return 'storage'; }
  get label() { return 'Storage'; }

  render(container, transport) {
    this.container = container;
    this.transport = transport;
    this._sections = new Set();
    container.innerHTML = '<div class="sv"><div class="emp">Click to load storage</div></div>';
    this.sv = container.querySelector('.sv');
  }

  onActivate() { this._loadStorage(); }
  onDeactivate() {}

  wireTransport(transport) {
    this.transport = transport;
    transport.on(MessageTypes.STORAGE_RESPONSE, msg => this._renderStorage(msg.payload));
    transport.on(MessageTypes.STORAGE_DELETED, () => this._loadStorage());
  }

  _loadStorage() {
    if (!this.transport) return;
    this.transport.send(createRequest(MessageTypes.STORAGE_GET_LOCAL));
    this.transport.send(createRequest(MessageTypes.STORAGE_GET_SESSION));
    this.transport.send(createRequest(MessageTypes.STORAGE_GET_COOKIES));
  }

  _renderStorage(d) {
    const emp = this.sv.querySelector('.emp');
    if (emp) emp.style.display = 'none';

    let sec = this.sv.querySelector(`[data-s="${d.type}"]`);
    const labels = { local: 'Local Storage', session: 'Session Storage', cookies: 'Cookies' };

    if (!sec) {
      sec = document.createElement('div');
      sec.className = 'ss';
      sec.dataset.s = d.type;
      sec.innerHTML = `
        <div class="sh">
          <h3>${labels[d.type] || d.type}</h3>
          <div class="abtn"><button class="clear-btn" data-type="${d.type}">Clear All</button></div>
        </div>`;
      this.sv.appendChild(sec);

      sec.querySelector('.clear-btn').addEventListener('click', () => {
        this.transport.send({ type: MessageTypes.STORAGE_CLEAR, payload: { type: d.type } });
        setTimeout(() => this._loadStorage(), 100);
      });
    }

    const old = sec.querySelector('.st-wrap');
    if (old) old.remove();

    const items = d.items || d.cookies || [];
    if (!items.length) return;

    const wrap = document.createElement('div');
    wrap.className = 'st-wrap';
    const tbl = document.createElement('table');
    tbl.className = 'st';
    tbl.innerHTML = `
      <thead><tr><th style="width:30%">Key</th><th>Value</th><th style="width:30px"></th></tr></thead>
      <tbody>${items.map(i => `<tr data-type="${d.type}" data-key="${this._esc(i.key || i.name)}">
        <td title="${this._esc(i.key || i.name)}">${i.key || i.name}</td>
        <td>${i.value}</td>
        <td class="del-row" data-type="${d.type}" data-key="${this._esc(i.key || i.name)}">✕</td>
      </tr>`).join('')}</tbody>`;
    wrap.appendChild(tbl);
    sec.appendChild(wrap);

    tbl.querySelectorAll('.del-row').forEach(btn => {
      btn.addEventListener('click', () => {
        this.transport.send({ type: MessageTypes.STORAGE_DELETE, payload: { type: btn.dataset.type, key: btn.dataset.key } });
        setTimeout(() => this._loadStorage(), 100);
      });
    });
  }

  _esc(s) { return s.replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
}
