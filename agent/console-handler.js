import { MessageTypes, createMessage, createResponse } from '../protocol/index.js';

// Console handler for evaluating expressions and capturing console output
export class ConsoleHandler {
  constructor(transport) {
    this.transport = transport;
    this._originalConsole = {};
    this._registerHandlers();
    this._interceptConsole();
  }

  _registerHandlers() {
    this.transport.on(MessageTypes.CONSOLE_EVALUATE, (msg) => this._handleEvaluate(msg));
  }

  async _handleEvaluate(msg) {
    const { expression } = msg.payload;
    try {
      // Use indirect eval for global scope execution
      const result = (0, eval)(expression);
      this.transport.send(createResponse(msg.id, MessageTypes.CONSOLE_EVALUATE_RESULT, {
        result: this._serializeResult(result),
        type: typeof result,
      }));
    } catch (error) {
      this.transport.send(createResponse(msg.id, MessageTypes.CONSOLE_EVALUATE_RESULT, null, error.message));
    }
  }

  _interceptConsole() {
    const methods = ['log', 'info', 'warn', 'error', 'debug'];
    const self = this;

    for (const method of methods) {
      this._originalConsole[method] = console[method];
      console[method] = function(...args) {
        // Call original
        self._originalConsole[method].apply(console, args);

        // Send to UI
        self.transport.send(createMessage(MessageTypes.CONSOLE_MESSAGE_ADDED, {
          level: method,
          args: args.map(arg => self._serializeResult(arg)),
          timestamp: Date.now(),
        }));
      };
    }

    // Capture uncaught exceptions and errors
    this._capturePageErrors();
  }

  _capturePageErrors() {
    const self = this;

    // Capture JavaScript errors
    window.addEventListener('error', (event) => {
      const error = event.error || event.message;
      const message = error instanceof Error
        ? { type: 'error', display: error.message, stack: error.stack }
        : { type: 'error', display: String(error) };

      self.transport.send(createMessage(MessageTypes.CONSOLE_MESSAGE_ADDED, {
        level: 'error',
        args: [message],
        timestamp: Date.now(),
        source: 'page-error',
      }));
    });

    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      const message = reason instanceof Error
        ? { type: 'error', display: `Unhandled Promise Rejection: ${reason.message}`, stack: reason.stack }
        : { type: 'error', display: `Unhandled Promise Rejection: ${String(reason)}` };

      self.transport.send(createMessage(MessageTypes.CONSOLE_MESSAGE_ADDED, {
        level: 'error',
        args: [message],
        timestamp: Date.now(),
        source: 'unhandledrejection',
      }));
    });
  }

  _serializeResult(value) {
    if (value === undefined) return { type: 'undefined', display: 'undefined' };
    if (value === null) return { type: 'null', display: 'null' };
    if (typeof value === 'symbol') return { type: 'symbol', display: value.toString() };
    if (typeof value === 'function') return { type: 'function', display: value.toString() };
    if (typeof value === 'object') {
      if (value instanceof Error) {
        return { type: 'error', display: value.message, stack: value.stack };
      }
      if (value instanceof Promise) {
        return { type: 'promise', display: 'Promise' };
      }
      if (value instanceof Map) {
        return { type: 'map', display: `Map(${value.size})`, entries: Array.from(value.entries()).map(([k, v]) => [this._serializeResult(k), this._serializeResult(v)]) };
      }
      if (value instanceof Set) {
        return { type: 'set', display: `Set(${value.size})`, values: Array.from(value).map(v => this._serializeResult(v)) };
      }
      if (Array.isArray(value)) {
        return { type: 'array', display: `Array(${value.length})`, value: value.map(v => this._serializeResult(v)) };
      }
      try {
        const json = JSON.stringify(value);
        return { type: 'object', display: json, value: json };
      } catch {
        return { type: 'object', display: value.toString() };
      }
    }
    return { type: typeof value, display: String(value), value };
  }

  destroy() {
    const methods = ['log', 'info', 'warn', 'error', 'debug'];
    for (const method of methods) {
      if (this._originalConsole[method]) {
        console[method] = this._originalConsole[method];
      }
    }
  }
}
