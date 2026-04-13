import { MessageTypes, createResponse } from '../protocol/index.js';

// Device handler - collects device info and handles device emulation
export class DeviceHandler {
  constructor(transport) {
    this.transport = transport;
    this.originalUserAgent = navigator.userAgent;
    this.currentOrientation = this._getOrientation();
    this.networkThrottle = { online: navigator.onLine, downlink: null, rtt: null };

    this._onGetInfo = this._onGetInfo.bind(this);
    this._onSetOrientation = this._onSetOrientation.bind(this);
    this._onSetThrottle = this._onSetThrottle.bind(this);
    this._onScreenshot = this._onScreenshot.bind(this);
    this._onOnlineChange = this._onOnlineChange.bind(this);

    this.transport.on(MessageTypes.DEVICE_GET_INFO, this._onGetInfo);
    this.transport.on(MessageTypes.DEVICE_SET_ORIENTATION, this._onSetOrientation);
    this.transport.on(MessageTypes.DEVICE_SET_THROTTLE, this._onSetThrottle);
    this.transport.on(MessageTypes.DEVICE_SCREENSHOT, this._onScreenshot);

    // Listen for online/offline changes
    window.addEventListener('online', this._onOnlineChange);
    window.addEventListener('offline', this._onOnlineChange);

    // Network Information API (if available)
    this._initNetworkInfo();
  }

  destroy() {
    this.transport.off(MessageTypes.DEVICE_GET_INFO, this._onGetInfo);
    this.transport.off(MessageTypes.DEVICE_SET_ORIENTATION, this._onSetOrientation);
    this.transport.off(MessageTypes.DEVICE_SET_THROTTLE, this._onSetThrottle);
    this.transport.off(MessageTypes.DEVICE_SCREENSHOT, this._onScreenshot);
    window.removeEventListener('online', this._onOnlineChange);
    window.removeEventListener('offline', this._onOnlineChange);
  }

  _initNetworkInfo() {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn) {
      this.networkThrottle.downlink = conn.downlink;
      this.networkThrottle.rtt = conn.rtt;
      this.networkThrottle.effectiveType = conn.effectiveType;
      
      conn.addEventListener('change', () => {
        this.networkThrottle.downlink = conn.downlink;
        this.networkThrottle.rtt = conn.rtt;
        this.networkThrottle.effectiveType = conn.effectiveType;
      });
    }
  }

  _onOnlineChange() {
    this.networkThrottle.online = navigator.onLine;
  }

  _getOrientation() {
    if (screen.orientation) {
      return screen.orientation.type;
    }
    return window.innerWidth > window.innerHeight ? 'landscape-primary' : 'portrait-primary';
  }

  _onGetInfo() {
    const info = this._collectDeviceInfo();
    const response = createResponse(
      'device_info',
      MessageTypes.DEVICE_INFO_RESPONSE,
      info
    );
    this.transport.send(response);
  }

  _onSetOrientation(msg) {
    const orientation = msg.payload?.orientation;
    if (!orientation) return;

    // Note: We can't actually change orientation from JS, but we can simulate it
    // by dispatching orientationchange event and updating CSS
    this.currentOrientation = orientation;
    
    // Simulate orientation change
    window.dispatchEvent(new Event('orientationchange'));
  }

  _onSetThrottle(msg) {
    const throttle = msg.payload;
    if (throttle.online !== undefined) {
      // We can't actually change online status, but we can track the setting
      this.networkThrottle.simulatedOnline = throttle.online;
    }
  }

  _onScreenshot() {
    try {
      // Use canvas to capture current viewport
      // Note: This is limited due to security restrictions
      const response = createResponse(
        'device_screenshot',
        MessageTypes.DEVICE_SCREENSHOT_RESPONSE,
        { 
          success: false, 
          error: 'Screenshot not supported in this context' 
        }
      );
      this.transport.send(response);
    } catch (err) {
      const response = createResponse(
        'device_screenshot',
        MessageTypes.DEVICE_SCREENSHOT_RESPONSE,
        { success: false, error: err.message }
      );
      this.transport.send(response);
    }
  }

  _collectDeviceInfo() {
    const ua = navigator.userAgent;
    const uaData = navigator.userAgentData;
    
    // Parse basic device info
    const platform = {
      userAgent: ua,
      platform: navigator.platform,
      language: navigator.language,
      languages: navigator.languages,
      cookieEnabled: navigator.cookieEnabled,
      // doNotTrack: navigator.doNotTrack,
      maxTouchPoints: navigator.maxTouchPoints || 0,
      hardwareConcurrency: navigator.hardwareConcurrency || 1,
      deviceMemory: navigator.deviceMemory || null
    };

    // Screen info
    const screen = {
      width: window.screen.width,
      height: window.screen.height,
      availWidth: window.screen.availWidth,
      availHeight: window.screen.availHeight,
      colorDepth: window.screen.colorDepth,
      pixelDepth: window.screen.pixelDepth,
      orientation: this.currentOrientation,
      devicePixelRatio: window.devicePixelRatio || 1
    };

    // Viewport info
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };

    // Battery info (if available)
    const battery = this._batteryInfo;

    // Network info
    const network = {
      online: navigator.onLine,
      downlink: this.networkThrottle.downlink,
      rtt: this.networkThrottle.rtt,
      effectiveType: this.networkThrottle.effectiveType
    };

    // Browser features
    const features = {
      serviceWorker: 'serviceWorker' in navigator,
      webGL: this._checkWebGL(),
      webGL2: this._checkWebGL2(),
      webRTC: this._checkWebRTC(),
      webSocket: 'WebSocket' in window,
      indexedDB: 'indexedDB' in window,
      localStorage: this._checkLocalStorage(),
      sessionStorage: this._checkSessionStorage(),
      notifications: 'Notification' in window,
      pushManager: 'PushManager' in window,
      geolocation: 'geolocation' in navigator,
      camera: 'mediaDevices' in navigator,
      microphone: 'mediaDevices' in navigator,
      bluetooth: 'bluetooth' in navigator,
      usb: 'usb' in navigator,
      vibrate: 'vibrate' in navigator,
      clipboard: 'clipboard' in navigator,
      share: 'share' in navigator
    };

    return {
      platform,
      screen,
      viewport,
      network,
      features,
      timestamp: Date.now()
    };
  }

  _checkWebGL() {
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
    } catch (e) {
      return false;
    }
  }

  _checkWebGL2() {
    try {
      const canvas = document.createElement('canvas');
      return !!canvas.getContext('webgl2');
    } catch (e) {
      return false;
    }
  }

  _checkWebRTC() {
    return 'RTCPeerConnection' in window || 'webkitRTCPeerConnection' in window;
  }

  _checkLocalStorage() {
    try {
      localStorage.setItem('__test__', 'test');
      localStorage.removeItem('__test__');
      return true;
    } catch (e) {
      return false;
    }
  }

  _checkSessionStorage() {
    try {
      sessionStorage.setItem('__test__', 'test');
      sessionStorage.removeItem('__test__');
      return true;
    } catch (e) {
      return false;
    }
  }
}
