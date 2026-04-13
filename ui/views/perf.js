import { MessageTypes, createRequest } from '../../protocol/index.js';

export class PerfView {
  static css() {
    return `
.pv { flex:1; overflow:auto; padding:8px; display:flex; flex-direction:column; gap:8px; }

/* FPS Display */
.fps-display { display:flex; align-items:baseline; gap:8px; }
.fps-value { font-size:32px; font-weight:bold; color:#4fc1ff; }
.fps-label { font-size:12px; color:#808080; }
.fps-status { font-size:11px; padding:2px 8px; border-radius:3px; }
.fps-status.good { color:#6a9955; background:rgba(106,153,85,.1); }
.fps-status.warn { color:#dcdcaa; background:rgba(220,220,170,.1); }
.fps-status.bad { color:#f48771; background:rgba(244,135,113,.1); }

/* FPS Graph */
.fps-graph { width:100%; height:80px; margin-top:8px; background:#2a2a2a; border-radius:4px; position:relative; overflow:hidden; }
.fps-graph canvas { display:block; width:100% !important; height:100% !important; }

/* Metric rows */
.mrow { display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #2a2a2a; }
.mrow:last-child { border-bottom:none; }
.mrow-label { color:#808080; }
.mrow-value { color:#ccc; font-weight:600; }
.mrow-value.time { color:#4fc1ff; }
.mrow-value.size { color:#6a9955; }
.mrow-value.count { color:#dcdcaa; }

/* Timing bars */
.tbar-container { margin:8px 0; }
.tbar-row { display:flex; align-items:center; margin:4px 0; }
.tbar-label { width:140px; font-size:11px; color:#808080; }
.tbar-bar { flex:1; height:16px; background:#2a2a2a; border-radius:2px; overflow:hidden; position:relative; }
.tbar-fill { height:100%; border-radius:2px; transition:width 0.3s ease; }
.tbar-fill.dom { background:#4a9eff; }
.tbar-fill.paint { background:#6a9955; }
.tbar-fill.load { background:#dcdcaa; }
.tbar-value { width:60px; text-align:right; font-size:11px; color:#ccc; }

/* Memory display */
.mem-container { display:flex; gap:12px; }
.mem-item { flex:1; }
.mem-label { font-size:10px; color:#808080; margin-bottom:4px; }
.mem-bar { height:8px; background:#2a2a2a; border-radius:2px; overflow:hidden; }
.mem-fill { height:100%; background:#4a9eff; border-radius:2px; }
.mem-value { font-size:11px; color:#ccc; margin-top:2px; }

/* Long tasks */
.lt-item { padding:4px 0; border-bottom:1px solid #2a2a2a; }
.lt-item:last-child { border-bottom:none; }
.lt-time { font-size:10px; color:#808080; }
.lt-duration { font-size:11px; color:#f48771; }

/* Auto-refresh toggle */
.auto-refresh { display:flex; align-items:center; gap:6px; font-size:11px; color:#808080; cursor:pointer; }
.auto-refresh input { margin:0; }
`;
  }
  
  get id() { return 'perf'; }
  get label() { return 'Performance'; }

  constructor() {
    this.metrics = null;
    this.autoRefresh = true;
    this.refreshTimer = null;
    this.fpsHistory = [];
    this.maxFpsHistory = 60;
    this.graphConfig = {
      maxFPS: 60,
      goodThreshold: 50,
      warnThreshold: 30,
      lineColor: '#4fc1ff',
      goodColor: '#6a9955',
      warnColor: '#dcdcaa',
      badColor: '#f48771',
      gridColor: '#3c3c3c',
      bgColor: '#2a2a2a'
    };
  }

  render(container, transport) {
    this.container = container;
    this.transport = transport;
    
    container.innerHTML = `
      <div class="pv">
        <div class="psec">
          <div class="psec-hdr">
            <h3>FPS</h3>
          </div>
          <div class="psec-body">
            <div class="fps-display">
              <span class="fps-value">--</span>
              <span class="fps-label">FPS</span>
              <span class="fps-status">Waiting...</span>
            </div>
            <div class="fps-graph">
              <canvas id="fps-graph-canvas"></canvas>
            </div>
          </div>
        </div>

        <div class="psec">
          <div class="psec-hdr">
            <h3>Timing</h3>
            <button class="refresh" title="Refresh">↻</button>
          </div>
          <div class="psec-body">
            <div class="tbar-container" id="timing-bars"></div>
          </div>
        </div>

        <div class="psec">
          <div class="psec-hdr">
            <h3>Resources</h3>
          </div>
          <div class="psec-body" id="resources-body"></div>
        </div>

        <div class="psec">
          <div class="psec-hdr">
            <h3>Memory</h3>
          </div>
          <div class="psec-body" id="memory-body"></div>
        </div>

        <div class="psec">
          <div class="psec-hdr">
            <h3>Long Tasks</h3>
          </div>
          <div class="psec-body" id="longtasks-body"></div>
        </div>
      </div>`;

    // Refresh button
    container.querySelector('.refresh').addEventListener('click', () => this._refreshMetrics());

    // Initialize canvas
    this._initFPSGraph();
  }

  onActivate() {
    this._refreshMetrics();
    this._startAutoRefresh();
  }

  onDeactivate() {
    this._stopAutoRefresh();
    // Clear FPS history
    this.fpsHistory = [];
  }

  wireTransport(transport) {
    this.transport = transport;
    
    transport.on(MessageTypes.PERF_METRICS_RESPONSE, msg => {
      if (msg.payload) {
        this.metrics = msg.payload;
        this._renderMetrics(this.metrics);
      }
    });

    transport.on(MessageTypes.PERF_FPS_UPDATE, msg => {
      this._updateFPS(msg.payload.fps);
    });

    transport.on(MessageTypes.PERF_TIMING_UPDATE, msg => {
      this.metrics = msg.payload;
      this._renderMetrics(this.metrics);
    });
  }

  _refreshMetrics() {
    this.transport.send(createRequest(MessageTypes.PERF_GET_METRICS, {}));
  }

  _startAutoRefresh() {
    if (this.autoRefresh) {
      this.refreshTimer = setInterval(() => {
        this._refreshMetrics();
      }, 2000);
    }
  }

  _stopAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  _updateFPS(fps) {
    const fpsEl = this.container.querySelector('.fps-value');
    const statusEl = this.container.querySelector('.fps-status');

    if (!fpsEl) return;

    fpsEl.textContent = fps;

    // Add to history
    this.fpsHistory.push(fps);
    if (this.fpsHistory.length > this.maxFpsHistory) {
      this.fpsHistory.shift();
    }

    // Draw graph
    this._drawFPSGraph();

    if (statusEl) {
      statusEl.className = 'fps-status';
      if (fps >= 50) {
        statusEl.classList.add('good');
        statusEl.textContent = 'Smooth';
      } else if (fps >= 30) {
        statusEl.classList.add('warn');
        statusEl.textContent = 'Moderate';
      } else {
        statusEl.classList.add('bad');
        statusEl.textContent = 'Slow';
      }
    }
  }

  _initFPSGraph() {
    const canvas = this.container.querySelector('#fps-graph-canvas');
    if (!canvas) return;

    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      const rect = canvas.parentElement.getBoundingClientRect();
      
      if (rect.width === 0 || rect.height === 0) {
        // Fallback: use parent's explicit dimensions
        const parent = canvas.parentElement;
        const parentWidth = parent.offsetWidth || 300;
        const parentHeight = parent.offsetHeight || 80;
        
        const dpr = window.devicePixelRatio || 1;
        canvas.width = parentWidth * dpr;
        canvas.height = parentHeight * dpr;
        canvas.style.width = `${parentWidth}px`;
        canvas.style.height = `${parentHeight}px`;
      } else {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
      }

      const ctx = canvas.getContext('2d');
      const width = parseFloat(canvas.style.width);
      const height = parseFloat(canvas.style.height);
      const dpr = window.devicePixelRatio || 1;
      
      ctx.scale(dpr, dpr);

      // Draw initial empty state
      ctx.fillStyle = this.graphConfig.bgColor;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = '#808080';
      ctx.font = '10px Menlo, Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Waiting for FPS data...', width / 2, height / 2);
    });
  }

  _drawFPSGraph() {
    const canvas = this.container.querySelector('#fps-graph-canvas');
    if (!canvas || this.fpsHistory.length === 0) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    // Get dimensions from parent or use explicit styles
    let rect = canvas.getBoundingClientRect();
    
    if (rect.width === 0 || rect.height === 0) {
      const parent = canvas.parentElement;
      rect = {
        width: parent.offsetWidth || 300,
        height: parent.offsetHeight || 80
      };
      
      // Set explicit dimensions
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    }

    const width = rect.width;
    const height = rect.height;

    // Set actual size in memory (scaled to account for retina displays)
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    // Scale all drawing operations by dpr
    ctx.scale(dpr, dpr);

    const padding = { top: 8, right: 8, bottom: 8, left: 8 };
    const graphWidth = width - padding.left - padding.right;
    const graphHeight = height - padding.top - padding.bottom;

    // Clear canvas
    ctx.fillStyle = this.graphConfig.bgColor;
    ctx.fillRect(0, 0, width, height);

    // Draw grid lines
    ctx.strokeStyle = this.graphConfig.gridColor;
    ctx.lineWidth = 0.5;
    const gridLines = [0, 30, 60];
    ctx.setLineDash([2, 2]);

    gridLines.forEach(fps => {
      const y = padding.top + graphHeight - (fps / this.graphConfig.maxFPS) * graphHeight;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      // Draw label
      ctx.fillStyle = '#808080';
      ctx.font = '9px Menlo, Consolas, monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(fps.toString(), 2, y);
    });

    ctx.setLineDash([]);

    // Draw FPS line with color coding
    const stepX = graphWidth / (this.maxFpsHistory - 1);
    const startX = padding.left + (this.maxFpsHistory - this.fpsHistory.length) * stepX;

    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Draw segments with different colors
    for (let i = 0; i < this.fpsHistory.length - 1; i++) {
      const fps = this.fpsHistory[i];
      const nextFps = this.fpsHistory[i + 1];

      const x1 = startX + i * stepX;
      const y1 = padding.top + graphHeight - (fps / this.graphConfig.maxFPS) * graphHeight;
      const x2 = startX + (i + 1) * stepX;
      const y2 = padding.top + graphHeight - (nextFps / this.graphConfig.maxFPS) * graphHeight;

      // Color based on FPS value
      if (fps >= this.graphConfig.goodThreshold) {
        ctx.strokeStyle = this.graphConfig.goodColor;
      } else if (fps >= this.graphConfig.warnThreshold) {
        ctx.strokeStyle = this.graphConfig.warnColor;
      } else {
        ctx.strokeStyle = this.graphConfig.badColor;
      }

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // Draw current FPS point
    const currentFps = this.fpsHistory[this.fpsHistory.length - 1];
    const lastX = startX + (this.fpsHistory.length - 1) * stepX;
    const lastY = padding.top + graphHeight - (currentFps / this.graphConfig.maxFPS) * graphHeight;

    // Glow effect
    ctx.shadowBlur = 6;
    ctx.shadowColor = currentFps >= this.graphConfig.goodThreshold
      ? this.graphConfig.goodColor
      : currentFps >= this.graphConfig.warnThreshold
      ? this.graphConfig.warnColor
      : this.graphConfig.badColor;

    ctx.fillStyle = ctx.shadowColor;
    ctx.beginPath();
    ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
    ctx.fill();

    // Reset shadow
    ctx.shadowBlur = 0;
  }

  _renderMetrics(metrics) {
    // Update FPS
    this._updateFPS(metrics.fps);
    
    // Update timing bars
    this._renderTimingBars(metrics.timing);
    
    // Update resources
    this._renderResources(metrics.resources);
    
    // Update memory
    this._renderMemory(metrics.memory);
    
    // Update long tasks
    this._renderLongTasks(metrics.longTasks);
  }

  _renderTimingBars(timing) {
    const container = this.container.querySelector('#timing-bars');
    if (!container || !timing) return;

    const maxTime = Math.max(timing.domReadyTime, timing.loadCompleteTime, 3000);
    
    const items = [
      { label: 'DOM Interactive', value: timing.domInteractive, cls: 'dom' },
      { label: 'DOM Content Loaded', value: timing.domContentLoaded, cls: 'dom' },
      { label: 'DOM Ready', value: timing.domReadyTime, cls: 'paint' },
      { label: 'First Paint', value: timing.firstPaint, cls: 'paint' },
      { label: 'First Contentful Paint', value: timing.firstContentfulPaint, cls: 'paint' },
      { label: 'Load Complete', value: timing.loadCompleteTime, cls: 'load' }
    ].filter(item => item.value !== null && item.value !== undefined);

    container.innerHTML = items.map(item => {
      const pct = Math.min((item.value / maxTime) * 100, 100);
      return `
        <div class="tbar-row">
          <span class="tbar-label">${item.label}</span>
          <div class="tbar-bar">
            <div class="tbar-fill ${item.cls}" style="width:${pct}%"></div>
          </div>
          <span class="tbar-value">${item.value}ms</span>
        </div>`;
    }).join('');
  }

  _renderResources(resources) {
    const container = this.container.querySelector('#resources-body');
    if (!container || !resources) return;

    const formatSize = (bytes) => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

    container.innerHTML = `
      <div class="mrow">
        <span class="mrow-label">Total Requests</span>
        <span class="mrow-value count">${resources.totalRequests}</span>
      </div>
      <div class="mrow">
        <span class="mrow-label">Total Size</span>
        <span class="mrow-value size">${formatSize(resources.totalSize)}</span>
      </div>
      <div class="mrow">
        <span class="mrow-label">Average Size</span>
        <span class="mrow-value size">${formatSize(resources.avgSize)}</span>
      </div>
    `;
  }

  _renderMemory(memory) {
    const container = this.container.querySelector('#memory-body');
    if (!container) return;

    if (!memory) {
      container.innerHTML = '<div style="color:#808080;font-size:11px;">Memory API not available</div>';
      return;
    }

    const formatMB = (bytes) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    const pct = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;

    container.innerHTML = `
      <div class="mem-container">
        <div class="mem-item">
          <div class="mem-label">Used Heap</div>
          <div class="mem-bar">
            <div class="mem-fill" style="width:${pct}%"></div>
          </div>
          <div class="mem-value">${formatMB(memory.usedJSHeapSize)}</div>
        </div>
        <div class="mem-item">
          <div class="mem-label">Total Heap</div>
          <div class="mem-value">${formatMB(memory.totalJSHeapSize)}</div>
        </div>
        <div class="mem-item">
          <div class="mem-label">Heap Limit</div>
          <div class="mem-value">${formatMB(memory.jsHeapSizeLimit)}</div>
        </div>
      </div>
    `;
  }

  _renderLongTasks(longTasks) {
    const container = this.container.querySelector('#longtasks-body');
    if (!container || !longTasks) return;

    if (longTasks.count === 0) {
      container.innerHTML = '<div style="color:#808080;font-size:11px;">No long tasks detected</div>';
      return;
    }

    container.innerHTML = `
      <div class="mrow">
        <span class="mrow-label">Total Long Tasks</span>
        <span class="mrow-value count">${longTasks.count}</span>
      </div>
      ${longTasks.entries.slice(-5).reverse().map(entry => `
        <div class="lt-item">
          <span class="lt-time">@${entry.startTime}ms</span>
          <span class="lt-duration">${entry.duration}ms</span>
        </div>
      `).join('')}
    `;
  }
}
