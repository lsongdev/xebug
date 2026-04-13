// Xebug all-in-one auto-initialization
// Just include this script and everything will be set up automatically:
// <script type="module" src="/init.js"></script>

import { LocalTransport } from './protocol/index.js';
import { Agent } from './agent/index.js';
import './ui/index.js';

/* ─────────────────────────────────────────────────────────
 *  <xebug-float-btn>
 * ───────────────────────────────────────────────────────── */
const floatBtnSheet = new CSSStyleSheet();
floatBtnSheet.replaceSync(`
:host { all:initial; display:block; }
.float-btn { position:fixed; bottom:20px; right:20px; width:44px; height:44px;
  border-radius:50%; background:#4a9eff; border:none; color:#fff; font-size:22px;
  cursor:grab; z-index:2147483647; box-shadow:0 4px 12px rgba(0,0,0,.4);
  display:flex; align-items:center; justify-content:center; padding:0; }
.float-btn:hover { transform:scale(1.1); }
.float-btn:active { cursor:grabbing; }
`);

class FloatBtn extends HTMLElement {
  constructor() {
    super();
    const s = this.attachShadow({ mode: 'open' });
    s.adoptedStyleSheets = [floatBtnSheet];
    s.innerHTML = '<button class="float-btn" title="Open Xebug DevTools">🐛</button>';
    s.querySelector('.float-btn').addEventListener('click', () =>
      this.dispatchEvent(new CustomEvent('xebug-open'))
    );
  }
}
customElements.define('xebug-float-btn', FloatBtn);

/* ─────────────────────────────────────────────────────────
 *  Init
 * ───────────────────────────────────────────────────────── */
export function initXebugUI() {
  const btn = document.createElement('xebug-float-btn');
  document.body.appendChild(btn);

  const panel = document.createElement('xebug-panel');
  document.body.appendChild(panel);

  let ready = false;
  btn.addEventListener('xebug-open', () => {
    if (!ready) {
      const t = new LocalTransport();
      t.initAsUI();
      panel.open(t);
      ready = true;
    } else {
      panel.show();
    }
  });

  return { floatBtn: btn, panel };
}

// Helper to inject agent into page
export function injectAgent() {
  const agent = new Agent();
  window.__XEBUG_AGENT__ = agent;
  return agent;
}

// Initialize agent
injectAgent().connect();

// Initialize UI
initXebugUI();
