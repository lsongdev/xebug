import { MessageTypes, createRequest } from '../../protocol/index.js';

export class ConsoleView {
  static css() {
    return `
.cv {
  flex:1;
  overflow:auto;
  padding:6px 4px;
  font-size:12px;
  /*background:#1e1e1e; */
}
.cm { padding:3px 8px; border-bottom:1px solid #2a2a2a; white-space:pre-wrap; word-break:break-all; }
.cm.warn { color:#dcdcaa; background:rgba(220,220,170,.06); }
.cm.error { color:#f48771; background:rgba(244,135,113,.06); }
.cm.info { color:#4fc1ff; }
.cbar { display:flex; border-top:1px solid #3c3c3c; background:#1e1e1e; flex-shrink:0; }
.cbar .cp { padding:8px; color:#4a9eff; user-select:none; }
.cbar input { flex:1; background:transparent; border:none; color:#ccc; font-family:Menlo,Consolas,monospace; font-size:12px; padding:8px; outline:none; }
`;
  }
  get id() { return 'console'; }
  get label() { return 'Console'; }

  render(container, transport) {
    this.container = container;
    this.transport = transport;
    container.innerHTML = `
      <div class="cv"></div>
      <div class="cbar"><span class="cp">❯</span><input placeholder="Evaluate JavaScript…"/></div>`;
    this.msgs = container.querySelector('.cv');
    const inp = container.querySelector('.cbar input');
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const v = inp.value.trim();
        if (v) { this._eval(v); inp.value = ''; }
      }
    });
  }

  onActivate() {}
  onDeactivate() {}

  wireTransport(transport) {
    this.transport = transport;
    transport.on(MessageTypes.CONSOLE_MESSAGE_ADDED, msg => this._cmsg(msg.payload.level, msg.payload.args));
    transport.on(MessageTypes.CONSOLE_EVALUATE_RESULT, msg =>
      msg.error
        ? this._cmsg('error', [{ display: 'Error: ' + msg.error }])
        : this._cmsg('log', [{ display: '← ' + msg.payload.result.display }])
    );
  }

  _cmsg(lv, args) {
    const d = document.createElement('div');
    d.className = 'cm ' + lv;
    d.textContent = args.map(a => a.display).join(' ');
    this.msgs.appendChild(d);
    this.msgs.scrollTop = this.msgs.scrollHeight;
  }

  _eval(expr) {
    this._cmsg('log', [{ display: '❯ ' + expr }]);
    this.transport.send(createRequest(MessageTypes.CONSOLE_EVALUATE, { expression: expr }));
  }
}
