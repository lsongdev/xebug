import { MessageTypes, createRequest } from '../../protocol/index.js';

export class DOMView {
  static css() {
    return `
.dom { flex:1; overflow:auto; padding:4px; font-size:11px; line-height:1.5; display:flex; }
.dom-tree { flex:1; overflow:auto; padding:4px; }
.dom-styles { width:300px; border-left:1px solid #3c3c3c; overflow:auto; padding:8px; background:#1e1e1e; display:none; }
.dom-styles.active { display:block; }
.dn { padding:0px 4px; cursor:pointer; border-radius:3px; white-space:pre-line; }
.dn:hover { background:#2a2d2e; }
.dn.sel { background:#094771; }
.dt { color:#569cd6; } .dan { color:#9cdcfe; } .dav { color:#ce9178; } .dtx { color:#ccc; }
.style-section { margin-bottom:12px; }
.style-header { color:#569cd6; font-weight:bold; margin-bottom:4px; font-size:11px; }
.style-rule { background:#2a2d2e; padding:6px; margin-bottom:4px; border-radius:3px; font-size:10px; }
.style-rule .selector { color:#d7ba7d; margin-bottom:2px; }
.style-rule .css-text { color:#ccc; word-break:break-all; }
.style-prop { display:flex; justify-content:space-between; padding:2px 0; border-bottom:1px solid #2a2a2a; }
.style-prop .name { color:#9cdcfe; }
.style-prop .value { color:#ce9178; }
.style-close { float:right; color:#ccc; cursor:pointer; font-size:16px; line-height:1; }
.style-close:hover { color:#f48771; }
`;
  }
  get id() { return 'dom'; }
  get label() { return 'Elements'; }

  _escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  render(container, transport) {
    this.container = container;
    this.transport = transport;
    this.selectedNode = null;
    container.innerHTML = `
      <div class="dom">
        <div class="dom-tree"><div class="emp">Loading DOM…</div></div>
        <div class="dom-styles"></div>
      </div>`;
    this.domView = container.querySelector('.dom-tree');
    this.stylesView = container.querySelector('.dom-styles');
    this._loadDOM();
  }

  onActivate() { this._loadDOM(); }
  onDeactivate() {}

  wireTransport(transport) {
    this.transport = transport;
    transport.on(MessageTypes.DOM_TREE_RESPONSE, msg => {
      if (!this.domView) return;
      this.domView.innerHTML = '';
      msg.payload.tree
        ? this._domTree(msg.payload.tree, this.domView)
        : this.domView.innerHTML = '<div class="emp">Failed to load DOM</div>';
    });
    transport.on(MessageTypes.DOM_STYLE_RESPONSE, msg => {
      if (msg.payload && msg.payload.styles) {
        this._renderStyles(msg.payload.styles);
      } else if (msg.error) {
        console.error('Failed to get styles:', msg.error);
      }
    });
    
    // Close button handler for styles panel
    this.container.addEventListener('click', (e) => {
      if (e.target.classList.contains('style-close')) {
        this.stylesView.classList.remove('active');
        this.stylesView.innerHTML = '';
        const selectedNode = this.domView.querySelector('.dn.sel');
        if (selectedNode) selectedNode.classList.remove('sel');
      }
    });
  }

  _loadDOM() {
    if (this.transport) this.transport.send(createRequest(MessageTypes.DOM_GET_TREE));
  }

  _domTree(n, c, d = 0) {
    if (!n) return;
    const el = document.createElement('div');
    el.className = 'dn';
    el.style.paddingLeft = d * 12 + 'px';

    if (n.nodeType === 1) {
      const tag = n.nodeName.toLowerCase();
      let a = '';
      if (n.attributes?.length) {
        a = n.attributes.slice(0, 3).map(x =>
          ` <span class="dan">${this._escapeHtml(x.name)}</span>=<span class="dav">"${this._escapeHtml(x.value)}"</span>`
        ).join('');
      }
      el.innerHTML = `<span class="dt">&lt;${this._escapeHtml(tag)}</span>${a}<span class="dt">&gt;</span>`;
      c.appendChild(el);
      
      // Hover highlighting
      el.onmouseenter = () => this.transport.send({ type: MessageTypes.DOM_HIGHLIGHT_NODE, payload: { nodeId: n.id } });
      el.onmouseleave = () => this.transport.send({ type: MessageTypes.DOM_HIGHLIGHT_CLEAR });

      // Click to view styles
      el.onclick = () => {
        // Remove previous selection
        const prev = this.domView.querySelector('.dn.sel');
        if (prev) prev.classList.remove('sel');

        // Add selection
        el.classList.add('sel');
        this.selectedNode = n.id;

        // Request styles
        this.transport.send(createRequest(MessageTypes.DOM_GET_STYLE, { nodeId: n.id }));
      };
      
      // Render children
      if (n.children) {
        for (const ch of n.children) {
          this._domTree(ch, c, d + 1);
        }
      }
      
      // Add closing tag (skip for void elements)
      const voidElements = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'];
      if (!voidElements.includes(tag)) {
        const closeEl = document.createElement('div');
        closeEl.className = 'dn';
        closeEl.style.paddingLeft = d * 12 + 'px';
        closeEl.innerHTML = `<span class="dt">&lt;/${tag}&gt;</span>`;
        c.appendChild(closeEl);
      }
    } else if (n.nodeType === 3) {
      const t = n.nodeValue?.trim();
      if (t) {
        el.innerHTML = `<span class="dtx">${this._escapeHtml(t)}</span>`;
        c.appendChild(el);
      }
    }
  }

  _renderStyles(styles) {
    this.stylesView.classList.add('active');

    let html = '<span class="style-close">×</span>';
    
    // Inline styles
    if (styles.inline) {
      html += `<div class="style-section">
        <div class="style-header">Inline Styles</div>
        <div class="style-rule">
          <div class="css-text">${this._escapeHtml(styles.inline)}</div>
        </div>
      </div>`;
    }

    // Matched rules
    if (styles.rules && styles.rules.length > 0) {
      html += `<div class="style-section">
        <div class="style-header">Matched Rules</div>`;
      for (const rule of styles.rules) {
        html += `<div class="style-rule">
          <div class="selector">${this._escapeHtml(rule.selector)}</div>
          <div class="css-text">${this._escapeHtml(rule.cssText)}</div>
        </div>`;
      }
      html += `</div>`;
    }
    
    // Computed styles (show most common/important ones)
    if (styles.computed) {
      const importantProps = [
        'display', 'position', 'top', 'right', 'bottom', 'left',
        'width', 'height', 'margin', 'padding', 'border',
        'background', 'color', 'font-size', 'font-weight', 'font-family',
        'text-align', 'line-height', 'opacity', 'visibility',
        'overflow', 'z-index', 'flex', 'grid'
      ];
      
      html += `<div class="style-section">
        <div class="style-header">Computed Styles</div>`;
      
      for (const prop of importantProps) {
        if (styles.computed[prop]) {
          html += `<div class="style-prop">
            <span class="name">${this._escapeHtml(prop)}</span>
            <span class="value">${this._escapeHtml(styles.computed[prop])}</span>
          </div>`;
        }
      }
      html += `</div>`;
    }
    
    this.stylesView.innerHTML = html;
  }
}
