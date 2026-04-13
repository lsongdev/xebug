import { MessageTypes, createResponse } from '../protocol/index.js';

// DOM handler for agent
export class DOMHandler {
  constructor(transport) {
    this.transport = transport;
    this._registerHandlers();
  }

  _registerHandlers() {
    this.transport.on(MessageTypes.DOM_GET_TREE, (msg) => this._handleGetTree(msg));
    this.transport.on(MessageTypes.DOM_GET_STYLE, (msg) => this._handleGetStyle(msg));
    this.transport.on(MessageTypes.DOM_HIGHLIGHT_NODE, (msg) => this._handleHighlight(msg));
    this.transport.on(MessageTypes.DOM_HIGHLIGHT_CLEAR, () => this._handleClearHighlight());
  }

  async _handleGetTree(msg) {
    try {
      const tree = this._serializeNode(document.documentElement, 0, 5);
      const response = createResponse(msg.id, MessageTypes.DOM_TREE_RESPONSE, { tree });
      this.transport.send(response);
    } catch (error) {
      this.transport.send(createResponse(msg.id, MessageTypes.DOM_TREE_RESPONSE, null, error.message));
    }
  }

  async _handleGetStyle(msg) {
    try {
      const { nodeId } = msg.payload;
      const element = this._findNodeById(nodeId);
      
      if (!element) {
        throw new Error('Element not found');
      }
      
      if (element.nodeType !== Node.ELEMENT_NODE) {
        throw new Error('Selected node is not an element');
      }

      const computedStyle = window.getComputedStyle(element);
      const inlineStyles = element.style.cssText;
      const styles = {
        inline: inlineStyles,
        computed: {},
        rules: []
      };

      // Get all computed styles
      for (let i = 0; i < computedStyle.length; i++) {
        const prop = computedStyle[i];
        styles.computed[prop] = computedStyle.getPropertyValue(prop);
      }

      // Get matching CSS rules from stylesheets
      try {
        for (const sheet of document.styleSheets) {
          try {
            const rules = sheet.cssRules || sheet.rules;
            for (const rule of rules) {
              if (rule.selectorText && element.matches(rule.selectorText)) {
                styles.rules.push({
                  selector: rule.selectorText,
                  cssText: rule.cssText,
                  href: sheet.href || 'inline'
                });
              }
            }
          } catch (e) {
            // Cross-origin stylesheet, skip
          }
        }
      } catch (e) {
        // Style sheet access error
      }

      const response = createResponse(msg.id, MessageTypes.DOM_STYLE_RESPONSE, { nodeId, styles });
      this.transport.send(response);
    } catch (error) {
      this.transport.send(createResponse(msg.id, MessageTypes.DOM_STYLE_RESPONSE, null, error.message));
    }
  }

  _handleHighlight(msg) {
    const { nodeId } = msg.payload;
    const element = this._findNodeById(nodeId);
    if (!element) return;

    // Create highlight overlay
    let overlay = document.getElementById('xebug-highlight');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'xebug-highlight';
      overlay.style.cssText = `
        position: fixed;
        pointer-events: none;
        border: 1px dashed #4a9eff;
        background: rgba(74, 158, 255, 0.1);
        z-index: 2147483646;
      `;
      document.body.appendChild(overlay);
    }

    const rect = element.getBoundingClientRect();
    overlay.style.top = rect.top + 'px';
    overlay.style.left = rect.left + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
  }

  _handleClearHighlight() {
    const overlay = document.getElementById('xebug-highlight');
    if (overlay) overlay.remove();
  }

  _serializeNode(node, depth, maxDepth) {
    if (depth > maxDepth) return null;
    if (!node || node.nodeType === Node.DOCUMENT_TYPE_NODE) return null;

    const result = {
      id: this._getNodeId(node),
      nodeType: node.nodeType,
      nodeName: node.nodeName,
      nodeValue: node.nodeType === Node.TEXT_NODE ? node.nodeValue : null,
      children: [],
      attributes: [],
    };

    if (node.nodeType === Node.ELEMENT_NODE) {
      for (const attr of node.attributes) {
        result.attributes.push({ name: attr.name, value: attr.value });
      }
    }

    if (node.childNodes && depth < maxDepth) {
      for (const child of node.childNodes) {
        const serialized = this._serializeNode(child, depth + 1, maxDepth);
        if (serialized) {
          result.children.push(serialized);
        }
      }
    }

    return result;
  }

  _getNodeId(node) {
    if (!node._xebugId) {
      node._xebugId = `node_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    }
    return node._xebugId;
  }

  _findNodeById(id) {
    // Walk DOM tree to find node with matching ID (elements only for style lookup)
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    let node;
    while (node = walker.nextNode()) {
      if (node._xebugId === id) return node;
    }
    return null;
  }

  destroy() {
    this._handleClearHighlight();
  }
}
