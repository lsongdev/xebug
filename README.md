# 🐛 Xebug

A lightweight, zero-dependency in-browser debugging tool that runs entirely in the client. No build step, no server required — just drop a script tag and start debugging.

## Features

- **Elements Inspector** — Browse the DOM tree, hover to highlight elements, click to view computed styles, inline styles, and matched CSS rules.
- **Network Monitor** — Intercept and inspect `fetch` and `XMLHttpRequest` requests with full request/response headers and body viewing.
- **Storage Manager** — View, edit, and delete `localStorage`, `sessionStorage`, and cookies.
- **Console** — Capture `console.log/warn/error` output and evaluate JavaScript expressions directly from the panel.
- **Floating & Docked Modes** — Drag, resize, and toggle between floating window and bottom-docked panel.
- **Mobile-Friendly** — Full touch support for dragging and resizing on mobile devices.
- **Shadow DOM Isolated** — All UI components use Shadow DOM to avoid style conflicts with the host page.

## Quick Start

Add a single script tag to your page:

```html
<script type="module" src="https://lsong.org/xebug/init.js"></script>
```

That's it. A 🐛 button appears in the bottom-right corner. Click it to open the DevTools panel.

👉 **[View Live Demo](https://lsong.org/xebug/example)**

### Bookmarklet

Drag this link to your bookmarks bar, or copy and paste into the browser address bar to enable Xebug on any page:

```javascript
javascript:(()=>{const s=document.createElement('script');s.type='module';s.src='https://lsong.org/xebug/init.js';document.body.appendChild(s)})();
```

<a href="javascript:(function()%7B(()%3D%3E%7Bconst%20s%3Ddocument.createElement('script')%3Bs.type%3D'module'%3Bs.src%3D'https%3A%2F%2Flsong.org%2Fxebug%2Finit.js'%3Bdocument.body.appendChild(s)%7D)()%3B%7D)()%3B" >Xebug Debugger</a>

## Architecture

```
xebug/
├── init.js              ← All-in-one entry (FloatBtn + injectAgent + initXebugUI)
├── agent/               ← Runs inside the page, hooks into APIs
│   ├── index.js         ← Agent class
│   ├── dom-handler.js   ← DOM tree serialization & style inspection
│   ├── network-handler.js← Fetch/XHR interception
│   ├── console-handler.js← Console method interception
│   └── storage-handler.js← localStorage/sessionStorage/cookies
├── ui/                  ← DevTools panel UI (Web Components)
│   ├── index.js         ← <xebug-panel> + views registration
│   └── views/
│       ├── dom.js       ← DOM tree view with style panel
│       ├── network.js   ← Network table with request/response detail
│       ├── console.js   ← Console output & expression evaluator
│       └── storage.js   ← Storage viewer/editor
├── protocol/            ← Message types & transport layer
│   ├── messages.js      ← Message type constants & factories
│   ├── transport.js     ← LocalTransport (BroadcastChannel)
│   └── index.js         ← Re-exports
└── example/
    └── index.html       ← Demo page with test functions
```

## Advanced Usage

### Manual Initialization

If you need fine-grained control, import and initialize components individually:

```javascript
import { Agent } from './agent/index.js';

const agent = new Agent();
agent.connect();
```

### Custom Views

Register your own panels:

```javascript

class MyCustomView {
  static css() { return '.my-view { color: red; }'; }
  get id() { return 'custom'; }
  get label() { return 'My View'; }
  render(container, transport) { /* ... */ }
  wireTransport(transport) { /* ... */ }
}

XebugPanel.register(MyCustomView);
```

### Custom Handlers

Add your own agent-side handlers:

```javascript
import { Agent } from './agent/index.js';

// Create and connect agent
const agent = new Agent();
agent.connect();

// Access the transport to add custom message handlers
const transport = agent.getTransport();
transport.on('my:customMessage', (msg) => {
  // Handle custom message
});
```

## Browser Support

- Chrome 88+
- Edge 88+
- Safari 14.1+
- Firefox 100+

Requires support for:
- ES Modules
- Custom Elements v1
- Shadow DOM v1
- `CSSStyleSheet.prototype.replaceSync()`
- `BroadcastChannel` API

## License

MIT
