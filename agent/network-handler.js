import { MessageTypes, createMessage } from '../protocol/index.js';

// Network handler - intercepts fetch and XHR
export class NetworkHandler {
  constructor(transport) {
    this.transport = transport;
    this.entries = [];
    this._originalFetch = null;
    this._originalXHROpen = null;
    this._originalXHRSend = null;
    this._registerHandlers();
    this._intercept();
  }

  _registerHandlers() {
    this.transport.on(MessageTypes.NETWORK_GET_ENTRIES, (msg) => {
      this.transport.send({
        id: msg.id,
        type: MessageTypes.NETWORK_ENTRIES_RESPONSE,
        payload: { entries: this.entries },
      });
    });

    this.transport.on(MessageTypes.NETWORK_GET_ENTRY_DETAILS, (msg) => {
      const { entryId } = msg.payload;
      const entry = this.entries.find(e => e.id === entryId);
      
      if (entry) {
        this.transport.send({
          id: msg.id,
          type: MessageTypes.NETWORK_ENTRY_DETAILS_RESPONSE,
          payload: {
            entry: {
              ...entry,
              requestBody: entry.requestBody || null,
              responseBody: entry.responseBody || null,
            }
          },
        });
      } else {
        this.transport.send({
          id: msg.id,
          type: MessageTypes.NETWORK_ENTRY_DETAILS_RESPONSE,
          payload: { entry: null },
          error: 'Entry not found',
        });
      }
    });
  }

  _intercept() {
    this._interceptFetch();
    this._interceptXHR();
  }

  _interceptFetch() {
    this._originalFetch = window.fetch;
    const self = this;

    window.fetch = async function(...args) {
      const [resource, init] = args;
      const url = typeof resource === 'string' ? resource : resource.url;
      const method = init?.method || 'GET';

      const entry = {
        id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        type: 'fetch',
        method,
        url,
        status: 0,
        statusText: '',
        requestHeaders: init?.headers || {},
        responseHeaders: {},
        size: 0,
        duration: 0,
        startTime: Date.now(),
        endTime: 0,
        requestBody: null,
        responseBody: null,
      };

      // Capture request body
      if (init?.body) {
        entry.requestBody = typeof init.body === 'string' ? init.body : '[Binary Data]';
      }

      self.entries.push(entry);
      self.transport.send(createMessage(MessageTypes.NETWORK_ENTRY_ADDED, { entry }));

      try {
        const response = await self._originalFetch.apply(this, args);
        entry.endTime = Date.now();
        entry.duration = entry.endTime - entry.startTime;
        entry.status = response.status;
        entry.statusText = response.statusText;

        // Capture response headers
        response.headers.forEach((value, key) => {
          entry.responseHeaders[key] = value;
        });

        // Clone to get body data
        const clone = response.clone();
        clone.text().then(text => {
          entry.size = text.length;
          // Only store if not too large (limit to 100KB)
          if (text.length < 100 * 1024) {
            entry.responseBody = text;
          } else {
            entry.responseBody = '[Response too large]';
          }
          // Send update when response body is ready
          self.transport.send(createMessage(MessageTypes.NETWORK_ENTRY_ADDED, { entry }));
        }).catch(() => {
          entry.responseBody = '[Binary Data]';
          self.transport.send(createMessage(MessageTypes.NETWORK_ENTRY_ADDED, { entry }));
        });

        return response;
      } catch (error) {
        entry.endTime = Date.now();
        entry.duration = entry.endTime - entry.startTime;
        entry.error = error.message;
        // Send update on error
        self.transport.send(createMessage(MessageTypes.NETWORK_ENTRY_ADDED, { entry }));
        throw error;
      }
    };
  }

  _interceptXHR() {
    const self = this;

    this._originalXHROpen = XMLHttpRequest.prototype.open;
    this._originalXHRSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url) {
      this._xebugEntry = {
        id: `xhr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        type: 'xhr',
        method,
        url: typeof url === 'string' ? url : url.toString(),
        status: 0,
        statusText: '',
        requestHeaders: {},
        responseHeaders: {},
        size: 0,
        duration: 0,
        startTime: 0,
        endTime: 0,
        requestBody: null,
        responseBody: null,
      };
      return self._originalXHROpen.apply(this, arguments);
    };

    const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
    XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
      if (this._xebugEntry) {
        this._xebugEntry.requestHeaders[header] = value;
      }
      return originalSetRequestHeader.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function(body) {
      if (this._xebugEntry) {
        this._xebugEntry.startTime = Date.now();
        
        // Capture request body
        if (body) {
          this._xebugEntry.requestBody = typeof body === 'string' ? body : '[Binary Data]';
        }
        
        self.entries.push(this._xebugEntry);
        self.transport.send(createMessage(MessageTypes.NETWORK_ENTRY_ADDED, { entry: this._xebugEntry }));
      }

      this.addEventListener('load', function() {
        if (this._xebugEntry) {
          this._xebugEntry.endTime = Date.now();
          this._xebugEntry.duration = this._xebugEntry.endTime - this._xebugEntry.startTime;
          this._xebugEntry.status = this.status;
          this._xebugEntry.statusText = this.statusText;
          
          // Capture response headers
          const headers = this.getAllResponseHeaders();
          if (headers) {
            const headerLines = headers.split('\r\n');
            for (const line of headerLines) {
              const [key, ...valueParts] = line.split(': ');
              if (key && valueParts.length) {
                this._xebugEntry.responseHeaders[key] = valueParts.join(': ');
              }
            }
          }
          
          // Capture response body
          const response = this.response || this.responseText;
          if (response) {
            const responseStr = typeof response === 'string' ? response : String(response);
            if (responseStr.length < 100 * 1024) {
              this._xebugEntry.responseBody = responseStr;
            } else {
              this._xebugEntry.responseBody = '[Response too large]';
            }
            this._xebugEntry.size = responseStr.length;
          }
          
          // Send update when response is complete
          self.transport.send(createMessage(MessageTypes.NETWORK_ENTRY_ADDED, { entry: this._xebugEntry }));
        }
      });

      this.addEventListener('error', function() {
        if (this._xebugEntry) {
          this._xebugEntry.endTime = Date.now();
          this._xebugEntry.duration = this._xebugEntry.endTime - this._xebugEntry.startTime;
          this._xebugEntry.error = 'Network error';
          // Send update on error
          self.transport.send(createMessage(MessageTypes.NETWORK_ENTRY_ADDED, { entry: this._xebugEntry }));
        }
      });

      return self._originalXHRSend.apply(this, arguments);
    };
  }

  destroy() {
    if (this._originalFetch) window.fetch = this._originalFetch;
    if (this._originalXHROpen) XMLHttpRequest.prototype.open = this._originalXHROpen;
    if (this._originalXHRSend) XMLHttpRequest.prototype.send = this._originalXHRSend;
  }
}
