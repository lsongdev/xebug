import { MessageTypes, createResponse } from '../protocol/index.js';

// Performance handler - collects FPS, DOM ready time, and other performance metrics
export class PerformanceHandler {
  constructor(transport) {
    this.transport = transport;
    this.fpsInterval = null;
    this.isMonitoring = false;
    this.frameCount = 0;
    this.lastFpsTime = 0;
    this.currentFps = 0;

    this._onGetMetrics = this._onGetMetrics.bind(this);
    this._onStartMonitoring = this._onStartMonitoring.bind(this);
    this._onStopMonitoring = this._onStopMonitoring.bind(this);

    this.transport.on(MessageTypes.PERF_GET_METRICS, this._onGetMetrics);
    this.transport.on(MessageTypes.PERF_START_MONITORING, this._onStartMonitoring);
    this.transport.on(MessageTypes.PERF_STOP_MONITORING, this._onStopMonitoring);

    // Start FPS monitoring loop
    this._startFrameCounter();
  }

  destroy() {
    this._stopFrameCounter();
    this.transport.off(MessageTypes.PERF_GET_METRICS, this._onGetMetrics);
    this.transport.off(MessageTypes.PERF_START_MONITORING, this._onStartMonitoring);
    this.transport.off(MessageTypes.PERF_STOP_MONITORING, this._onStopMonitoring);
  }

  _startFrameCounter() {
    const measureFrame = (timestamp) => {
      this.frameCount++;
      
      if (this.lastFpsTime === 0) {
        this.lastFpsTime = timestamp;
      }
      
      const delta = timestamp - this.lastFpsTime;
      if (delta >= 1000) {
        this.currentFps = Math.round((this.frameCount * 1000) / delta);
        this.frameCount = 0;
        this.lastFpsTime = timestamp;
        
        if (this.isMonitoring) {
          this.transport.send({
            type: MessageTypes.PERF_FPS_UPDATE,
            payload: { fps: this.currentFps, timestamp: Date.now() }
          });
        }
      }
      
      if (this.isMonitoring) {
        requestAnimationFrame(measureFrame);
      }
    };
    
    this.isMonitoring = true;
    requestAnimationFrame(measureFrame);
  }

  _stopFrameCounter() {
    this.isMonitoring = false;
  }

  _onGetMetrics() {
    const metrics = this._collectMetrics();
    const response = createResponse(
      'perf_metrics',
      MessageTypes.PERF_METRICS_RESPONSE,
      metrics
    );
    this.transport.send(response);
  }

  _onStartMonitoring() {
    this.isMonitoring = true;
    this._startMonitoring();
  }

  _onStopMonitoring() {
    this.isMonitoring = false;
  }

  _collectMetrics() {
    const perf = window.performance;
    const navEntry = perf.getEntriesByType?.('navigation')?.[0] || {};
    
    // DOM timing metrics
    const domReadyTime = navEntry.domContentLoadedEventEnd - navEntry.startTime || 0;
    const loadCompleteTime = navEntry.loadEventEnd - navEntry.startTime || 0;
    const domInteractive = navEntry.domInteractive - navEntry.startTime || 0;
    const domContentLoaded = navEntry.domContentLoadedEventEnd - navEntry.startTime || 0;
    
    // Resource metrics
    const resourceEntries = perf.getEntriesByType?.('resource') || [];
    const totalResources = resourceEntries.length;
    const totalResourceSize = resourceEntries.reduce((sum, r) => sum + (r.transferSize || 0), 0);
    
    // Long tasks
    const longTaskEntries = perf.getEntriesByType?.('longtask') || [];
    const longTaskCount = longTaskEntries.length;
    
    // Paint timing
    const paintEntries = perf.getEntriesByType?.('paint') || [];
    const firstPaint = paintEntries.find(e => e.name === 'first-paint');
    const firstContentfulPaint = paintEntries.find(e => e.name === 'first-contentful-paint');
    
    // Memory (if available)
    const memory = perf.memory ? {
      usedJSHeapSize: perf.memory.usedJSHeapSize,
      totalJSHeapSize: perf.memory.totalJSHeapSize,
      jsHeapSizeLimit: perf.memory.jsHeapSizeLimit
    } : null;
    
    // Navigation info
    const navInfo = {
      type: navEntry.type || 'unknown',
      redirectCount: navEntry.redirectCount || 0,
      protocol: navEntry.nextHopProtocol || 'unknown'
    };

    return {
      fps: this.currentFps,
      timing: {
        domReadyTime: Math.round(domReadyTime),
        loadCompleteTime: Math.round(loadCompleteTime),
        domInteractive: Math.round(domInteractive),
        domContentLoaded: Math.round(domContentLoaded),
        firstPaint: firstPaint ? Math.round(firstPaint.startTime) : null,
        firstContentfulPaint: firstContentfulPaint ? Math.round(firstContentfulPaint.startTime) : null
      },
      resources: {
        totalRequests: totalResources,
        totalSize: totalResourceSize,
        avgSize: totalResources > 0 ? Math.round(totalResourceSize / totalResources) : 0
      },
      longTasks: {
        count: longTaskCount,
        entries: longTaskEntries.slice(-10).map(e => ({
          startTime: Math.round(e.startTime),
          duration: Math.round(e.duration)
        }))
      },
      memory: memory,
      navigation: navInfo,
      timestamp: Date.now()
    };
  }

  _startMonitoring() {
    // Send periodic timing updates
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    this.monitoringInterval = setInterval(() => {
      if (this.isMonitoring) {
        const metrics = this._collectMetrics();
        this.transport.send({
          type: MessageTypes.PERF_TIMING_UPDATE,
          payload: metrics
        });
      }
    }, 2000);
  }
}
