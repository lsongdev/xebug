import { DOMView } from './views/dom.js';
import { NetworkView } from './views/network.js';
import { StorageView } from './views/storage.js';
import { ConsoleView } from './views/console.js';
import { PerfView } from './views/perf.js';
import { DeviceView } from './views/device.js';
import { SettingsView } from './views/settings.js';

/* ─────────────────────────────────────────────────────────
 *  Shared stylesheet (layout, tabs, titlebar, etc.)
 * ───────────────────────────────────────────────────────── */
const sharedSheet = new CSSStyleSheet();
sharedSheet.replaceSync(`
:host { all:initial; display:block;
font-size: 11px;
font-family:Menlo,Consolas,'SF Mono',monospace;
color:#ccc; box-sizing:border-box;
}

*,*::before,*::after { box-sizing:inherit; }

.panel {
  margin: auto;
  position:fixed; 
  width:100%; height:50%;
  min-width: 300px;
  min-height: 150px;
  top:auto; left:0; right:0; bottom:0;
  background: rgba(0,0,0,.9);
  border-top:1px solid #3c3c3c;
  box-shadow:0 -4px 16px rgba(0,0,0,.3); z-index:2147483647;
  display:flex; flex-direction:column; overflow:hidden;
  resize:vertical; }
.panel.floating {
  width:90%; height:250px; top:50px; left:50px; right:auto; bottom:auto;
  border:1px solid #3c3c3c; border-radius:8px;
  box-shadow:0 8px 32px rgba(0,0,0,.5);
  resize:both; overflow:auto; }
.panel.floating::after {
  content:''; position:absolute; right:0; bottom:0; width:20px; height:20px;
  cursor:nwse-resize; z-index:10; }
.panel.off { display:none !important; }

.tbar {
  height:34px;
  /*background:#2d2d2d;*/
  border-bottom:1px solid #3c3c3c;
  display:flex;
  align-items:center;
  padding:0 8px; user-select:none; flex-shrink:0; cursor:move; }
.tbar .ttl { flex:1; font-size:12px; font-weight:600; }
.tbar .btns { display:flex; gap:4px; }
.tbar .btns button { width:24px; height:24px; border:none; background:transparent;
  color:#808080; cursor:pointer; border-radius:4px; font-size:14px; padding:0; }
.tbar .btns button:hover { background:#2a2d2e; color:#ccc; }

.tabs {
  display:flex;
  /*background:#2d2d2d;*/
  background: rgba(45,45,45,.5);
  border-bottom:1px solid #3c3c3c;
  overflow-x:auto;
  flex-shrink:0;
  scrollbar-width:none;
}
.tabs::-webkit-scrollbar { display:none; }
.tab { padding:8px 14px; color:#808080; font-size:12px; cursor:pointer;
  border:none; background:transparent; white-space:nowrap; position:relative;}
.tab:hover { color:#ccc; }
.tab.on { color:#ccc; }
.tab.on::after { content:''; position:absolute; bottom:0; left:0; right:0; height:2px; background:#4a9eff; }

.pane { flex:1; overflow:hidden; display:none; flex-direction:column; }
.pane.on { display:flex; }

.emp { display:flex; align-items:center; justify-content:center; height:100%; color:#808080; font-size:12px; }

/* ─────────────────────────────────────────────────────────
 *  Shared section styles (psec/dsec/ssec)
 * ───────────────────────────────────────────────────────── */
.psec, .dsec, .ssec { background:#1e1e1e; border:1px solid #2a2a2a; border-radius:4px; }
.psec-hdr, .dsec-hdr, .ssec-hdr { padding:8px 12px; background:#2d2d2d; border-bottom:1px solid #3c3c3c; }
.psec-hdr h3, .dsec-hdr h3, .ssec-hdr h3 { margin:0; font-size:12px; font-weight:600; color:#ccc; }
.psec-body, .dsec-body, .ssec-body { padding:12px; }
.psec-hdr, .dsec-hdr, .ssec-hdr { display:flex; justify-content:space-between; align-items:center; }
.psec-hdr .refresh, .dsec-hdr .refresh, .ssec-hdr .refresh { background:transparent; border:none; color:#808080; cursor:pointer; font-size:14px; padding:2px 6px; border-radius:3px; }
.psec-hdr .refresh:hover, .dsec-hdr .refresh:hover, .ssec-hdr .refresh:hover { background:#3c3c3c; color:#ccc; }
`);

/* ─────────────────────────────────────────────────────────
 *  <xebug-panel>
 * ───────────────────────────────────────────────────────── */
class XebugPanel extends HTMLElement {
  static _views = [];
  static _sheetsBuilt = false;

  static register(view) {
    XebugPanel._views.push(view);
  }

  constructor() {
    super();
    const s = this.attachShadow({ mode: 'open' });

    /* Merge shared + view CSS into adoptedStyleSheets */
    const allSheets = [sharedSheet];
    for (const v of XebugPanel._views) {
      const ViewClass = v.constructor;
      if (typeof ViewClass.css === 'function') {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(ViewClass.css());
        allSheets.push(sheet);
      }
    }
    s.adoptedStyleSheets = allSheets;

    /* Build tabs & panes from registered views */
    let tabs = '', panes = '';
    for (const v of XebugPanel._views) {
      tabs += `<button class="tab" data-t="${v.id}">${v.label}</button>`;
      panes += `<div class="pane" data-p="${v.id}"></div>`;
    }

    s.innerHTML = `
      <div class="panel off">
        <div class="tbar">
          <span class="ttl">Xebug DevTools</span>
          <div class="btns">
            <button class="mode-toggle" title="Toggle Floating Mode">⧉</button>
            <button class="cls" title="Close">✕</button>
          </div>
        </div>
        <div class="tabs">${tabs}</div>
        ${panes}
      </div>`;

    this._el = s.querySelector('.panel');
    this._t = null;
    this._viewMap = new Map();
    this._active = null;
    this._isFloating = false;
    this._dragState = null;
    this._resizeState = null;

    /* First tab active */
    const firstTab = s.querySelector('.tab');
    if (firstTab) firstTab.classList.add('on');
    const firstPane = s.querySelector('.pane');
    if (firstPane) firstPane.classList.add('on');

    /* Tab switch */
    s.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => {
      s.querySelectorAll('.tab').forEach(b => b.classList.remove('on'));
      s.querySelectorAll('.pane').forEach(p => p.classList.remove('on'));
      btn.classList.add('on');
      s.querySelector(`[data-p="${btn.dataset.t}"]`).classList.add('on');
      this._switch(btn.dataset.t);
    }));

    /* Drag functionality */
    const tbar = s.querySelector('.tbar');
    
    // Mouse drag on title bar
    tbar.addEventListener('mousedown', (e) => {
      if (!this._isFloating) return;
      if (e.target.closest('.btns button')) return;

      this._dragState = {
        startX: e.clientX,
        startY: e.clientY,
        startLeft: parseInt(this._el.style.left) || this._el.offsetLeft,
        startTop: parseInt(this._el.style.top) || this._el.offsetTop
      };

      document.addEventListener('mousemove', this._onDrag);
      document.addEventListener('mouseup', this._onDragEnd);
      e.preventDefault();
    });

    this._onDrag = (e) => {
      if (!this._dragState) return;
      const clientX = e.clientX ?? e.touches?.[0]?.clientX;
      const clientY = e.clientY ?? e.touches?.[0]?.clientY;
      if (clientX == null || clientY == null) return;
      
      const dx = clientX - this._dragState.startX;
      const dy = clientY - this._dragState.startY;
      this._el.style.left = `${this._dragState.startLeft + dx}px`;
      this._el.style.top = `${this._dragState.startTop + dy}px`;
    };

    this._onDragEnd = () => {
      this._dragState = null;
      document.removeEventListener('mousemove', this._onDrag);
      document.removeEventListener('mouseup', this._onDragEnd);
      document.removeEventListener('touchmove', this._onDrag);
      document.removeEventListener('touchend', this._onDragEnd);
    };

    this._onResize = (e) => {
      if (!this._resizeState) return;
      const clientX = e.clientX ?? e.touches?.[0]?.clientX;
      const clientY = e.clientY ?? e.touches?.[0]?.clientY;
      if (clientX == null || clientY == null) return;
      
      const dw = clientX - this._resizeState.startX;
      const dh = clientY - this._resizeState.startY;
      this._el.style.width = `${this._resizeState.startWidth + dw}px`;
      this._el.style.height = `${this._resizeState.startHeight + dh}px`;
    };

    this._onResizeEnd = () => {
      this._resizeState = null;
      document.removeEventListener('touchmove', this._onResize);
      document.removeEventListener('touchend', this._onResizeEnd);
    };

    // Touch events on panel for drag and resize
    this._el.addEventListener('touchstart', (e) => {
      if (!this._isFloating) return;
      
      const touch = e.touches[0];
      const target = e.target;
      
      // Check if touch is on title bar (for dragging)
      if (target.closest('.tbar') && !target.closest('.btns button')) {
        this._dragState = {
          startX: touch.clientX,
          startY: touch.clientY,
          startLeft: parseInt(this._el.style.left) || this._el.offsetLeft,
          startTop: parseInt(this._el.style.top) || this._el.offsetTop
        };
        e.preventDefault();
      } else {
        // Check if touch is near the resize handle (bottom-right corner)
        const rect = this._el.getBoundingClientRect();
        const offsetX = rect.right - touch.clientX;
        const offsetY = rect.bottom - touch.clientY;
        
        if (offsetX < 30 && offsetY < 30) {
          this._resizeState = {
            startX: touch.clientX,
            startY: touch.clientY,
            startWidth: rect.width,
            startHeight: rect.height
          };
          e.preventDefault();
        }
      }
    }, { passive: false });

    document.addEventListener('touchmove', (e) => {
      if (this._dragState) this._onDrag(e);
      if (this._resizeState) this._onResize(e);
    }, { passive: false });
    
    document.addEventListener('touchend', () => {
      if (this._dragState) this._onDragEnd();
      if (this._resizeState) this._onResizeEnd();
    });

    /* Toggle floating mode */
    s.querySelector('.mode-toggle').addEventListener('click', () => this._toggleFloating());

    s.querySelector('.cls').addEventListener('click', () => this.hide());
  }

  open(transport) {
    this._t = transport;
    this._el.classList.remove('off');
    for (const def of XebugPanel._views) {
      const pane = this.shadowRoot.querySelector(`[data-p="${def.id}"]`);
      def.render(pane, transport);
      def.wireTransport(transport);
      this._viewMap.set(def.id, def);
    }
    const first = XebugPanel._views[0]?.id;
    if (first) this._switch(first);
  }

  show() { this._el.classList.remove('off'); }
  hide() { this._el.classList.add('off'); }

  _toggleFloating() {
    this._isFloating = !this._isFloating;
    if (this._isFloating) {
      this._el.classList.add('floating');
      if (!this._el.style.left || this._el.style.left === '0px') {
        this._el.style.left = '50px';
        this._el.style.top = '50px';
        this._el.style.right = 'auto';
        this._el.style.bottom = 'auto';
      }
    } else {
      this._el.classList.remove('floating');
      this._el.style.top = '';
      this._el.style.left = '';
      this._el.style.right = '';
      this._el.style.bottom = '';
      this._el.style.width = '';
      this._el.style.height = '';
    }
  }

  _switch(id) {
    if (this._active && this._active !== id) this._viewMap.get(this._active)?.onDeactivate();
    this._viewMap.get(id)?.onActivate();
    this._active = id;
  }
}
customElements.define('xebug-panel', XebugPanel);

/* Register built-in views */
XebugPanel.register(new DOMView());
XebugPanel.register(new NetworkView());
XebugPanel.register(new StorageView());
XebugPanel.register(new ConsoleView());
XebugPanel.register(new PerfView());
XebugPanel.register(new DeviceView());
XebugPanel.register(new SettingsView());



