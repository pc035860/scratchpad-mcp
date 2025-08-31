// Viewer Controls: floating panel for line numbering and auto refresh/scroll
(function () {
  const detailEl = document.querySelector('.workflow-detail');
  if (!detailEl) return;

  const workflowId = detailEl.dataset.workflowId;
  const container = document.getElementById('scratchpads-container');
  if (!container) return;

  const PREFS = {
    lineOrder: `viewer:${workflowId}:lineOrder`, // 'asc' | 'desc'
    autoRefresh: `viewer:${workflowId}:autoRefresh`, // '1' | '0'
    autoScroll: `viewer:${workflowId}:autoScroll`, // '1' | '0'
  };

  // Helpers
  const getPref = (k, def) => window.localStorage.getItem(k) ?? def;
  const setPref = (k, v) => window.localStorage.setItem(k, v);

  function createControls() {
    const panel = document.createElement('div');
    panel.className = 'floating-controls';
    panel.innerHTML = `
      <button id="toggle-view" class="toggle-btn" type="button" aria-pressed="false">視圖: 渲染</button>
      <button id="toggle-line" class="toggle-btn" type="button" aria-pressed="false">行號: 正序</button>
      <button id="toggle-refresh" class="toggle-btn" type="button" aria-pressed="false" title="每隔數秒重新載入內容">自動刷新: 關</button>
      <button id="toggle-scroll" class="toggle-btn" type="button" aria-pressed="false" title="內容更新後自動捲到底部">自動捲動: 關</button>
    `;
    // 將面板插入到 scratchpads 區塊，貼齊渲染容器
    const host = document.querySelector('.scratchpads-section') || detailEl;
    host.insertBefore(panel, host.firstChild);

    function positionPanel() {
      const rect = host.getBoundingClientRect();
      const spacing = 16; // px
      const panelWidth = panel.offsetWidth || 300;
      const desiredLeft = Math.round(rect.right + spacing);
      const fitsRight = desiredLeft + panelWidth <= window.innerWidth - 8;
      if (fitsRight) {
        // 固定在視窗中，貼齊容器右外側
        panel.style.position = 'fixed';
        panel.style.left = desiredLeft + 'px';
        // 讓面板大致與容器頂對齊，並在視窗內夾取
        const desiredTop = Math.round(Math.max(16, Math.min(rect.top, window.innerHeight - (panel.offsetHeight || 0) - 16)));
        panel.style.top = desiredTop + 'px';
        panel.style.right = '';
        panel.style.marginLeft = '';
      } else {
        // 空間不足，退回容器內側右上角（sticky 效果）
        panel.style.position = 'sticky';
        panel.style.left = '';
        panel.style.top = '1rem';
        panel.style.right = '';
        panel.style.marginLeft = 'auto';
      }
    }
    // 初始定位 + 事件綁定
    positionPanel();
    window.addEventListener('scroll', positionPanel, { passive: true });
    window.addEventListener('resize', positionPanel);

    // Restore state
    const viewBtn = panel.querySelector('#toggle-view');
    const lineBtn = panel.querySelector('#toggle-line');
    const refreshBtn = panel.querySelector('#toggle-refresh');
    const scrollBtn = panel.querySelector('#toggle-scroll');

    // Default: rendered view
    const initialView = getPref(`viewer:${workflowId}:view`, 'rendered');
    const initialLine = getPref(PREFS.lineOrder, 'asc');
    const initialRefresh = getPref(PREFS.autoRefresh, '0') === '1';
    const initialScroll = getPref(PREFS.autoScroll, '0') === '1';
    function updateViewBtnLabel(mode) {
      viewBtn.textContent = `視圖: ${mode === 'raw' ? '原始' : '渲染'}`;
      viewBtn.setAttribute('aria-pressed', mode === 'raw' ? 'true' : 'false');
    }
    function updateLineBtnLabel(order) {
      lineBtn.textContent = `行號: ${order === 'desc' ? '倒序' : '正序'}`;
      lineBtn.setAttribute('aria-pressed', order === 'desc' ? 'true' : 'false');
    }
    function updateToggle(btn, on) {
      btn.textContent = `${btn.id === 'toggle-refresh' ? '自動刷新' : '自動捲動'}: ${on ? '開' : '關'}`;
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    updateViewBtnLabel(initialView);
    updateLineBtnLabel(initialLine);
    updateToggle(refreshBtn, initialRefresh);
    updateToggle(scrollBtn, initialScroll);
    updateLineToggleVisibility(initialView);

    applyViewMode(initialView);
    viewBtn.addEventListener('click', () => {
      const current = getPref(`viewer:${workflowId}:view`, 'rendered');
      const next = current === 'raw' ? 'rendered' : 'raw';
      setPref(`viewer:${workflowId}:view`, next);
      updateViewBtnLabel(next);
      applyViewMode(next);
      renderLineNumbersForAll();
      updateLineToggleVisibility(next);
    });
    lineBtn.addEventListener('click', () => {
      const current = getPref(PREFS.lineOrder, 'asc');
      const next = current === 'desc' ? 'asc' : 'desc';
      setPref(PREFS.lineOrder, next);
      updateLineBtnLabel(next);
      renderLineNumbersForAll();
    });
    refreshBtn.addEventListener('click', () => {
      const cur = getPref(PREFS.autoRefresh, '0') === '1';
      const next = !cur;
      setPref(PREFS.autoRefresh, next ? '1' : '0');
      updateToggle(refreshBtn, next);
    });
    scrollBtn.addEventListener('click', () => {
      const cur = getPref(PREFS.autoScroll, '0') === '1';
      const next = !cur;
      setPref(PREFS.autoScroll, next ? '1' : '0');
      updateToggle(scrollBtn, next);
    });
  }

  function updateLineToggleVisibility(mode) {
    const btn = document.querySelector('.floating-controls #toggle-line');
    if (!btn) return;
    btn.style.display = mode === 'raw' ? 'inline-flex' : 'none';
  }

  function renderLineNumbersForAll() {
    const order = getPref(PREFS.lineOrder, 'asc');
    const mode = getPref(`viewer:${workflowId}:view`, 'rendered');
    const items = container.querySelectorAll('.markdown-with-lines');
    // 在渲染視圖下不顯示行號，並清空 gutter
    if (mode !== 'raw') {
      items.forEach((wrap) => {
        const gutter = wrap.querySelector('.line-gutter');
        if (gutter) gutter.innerHTML = '';
      });
      return;
    }
    items.forEach((wrap) => {
      const gutter = wrap.querySelector('.line-gutter');
      if (!gutter) return;
      const lineCount = parseInt(wrap.getAttribute('data-line-count') || '0', 10);
      if (!Number.isFinite(lineCount) || lineCount <= 0) {
        gutter.innerHTML = '';
        return;
      }
      // Efficient bulk render
      const frag = document.createDocumentFragment();
      if (order === 'desc') {
        for (let i = lineCount; i >= 1; i--) {
          const s = document.createElement('span');
          s.className = 'line-num';
          s.textContent = String(i);
          frag.appendChild(s);
        }
      } else {
        for (let i = 1; i <= lineCount; i++) {
          const s = document.createElement('span');
          s.className = 'line-num';
          s.textContent = String(i);
          frag.appendChild(s);
        }
      }
      gutter.replaceChildren(frag);
    });
  }

  function decodeRaw(b64) {
    try {
      return decodeURIComponent(escape(window.atob(b64)));
    } catch {
      // Fallback for UTF-8 decoding in older browsers
      return atob(b64);
    }
  }

  function applyViewMode(mode) {
    document.body.classList.toggle('view-raw', mode === 'raw');
    document.body.classList.toggle('view-rendered', mode !== 'raw');
    const items = container.querySelectorAll('.markdown-with-lines');
    items.forEach((wrap) => {
      let rawEl = wrap.querySelector('.raw-view');
      if (mode === 'raw') {
        if (!rawEl) {
          const b64 = wrap.getAttribute('data-raw-b64') || '';
          const pre = document.createElement('pre');
          pre.className = 'raw-view';
          pre.textContent = b64 ? decodeRaw(b64) : '';
          wrap.appendChild(pre);
        }
      }
    });
  }

  async function autoRefreshLoop() {
    const intervalBase = 5000; // 5s
    let sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    let lastUpdated = detailEl.dataset.updatedAt || '';
    while (true) {
      const enabled = getPref(PREFS.autoRefresh, '0') === '1';
      if (!enabled) {
        await sleep(intervalBase);
        continue;
      }
      try {
        const res = await fetch(window.location.href, { headers: { 'X-Partial': 'scratchpads' } });
        const html = await res.text();
        // Parse and extract scratchpads container
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const newDetail = doc.querySelector('.workflow-detail');
        const newUpdated = newDetail ? (newDetail.dataset.updatedAt || '') : '';
        const newContainer = doc.getElementById('scratchpads-container');
        if (newContainer && newUpdated && newUpdated !== lastUpdated) {
          container.replaceChildren(...Array.from(newContainer.childNodes));
          renderLineNumbersForAll();
          // re-apply view mode after refresh
          const currentView = getPref(`viewer:${workflowId}:view`, 'rendered');
          applyViewMode(currentView);
          updateLineToggleVisibility(currentView);
          lastUpdated = newUpdated;
          if (getPref(PREFS.autoScroll, '0') === '1') {
            container.scrollTop = container.scrollHeight;
            window.scrollTo({ top: document.body.scrollHeight });
          }
        }
      } catch (e) {
        // swallow errors to keep loop running
      }
      await sleep(intervalBase);
    }
  }

  // Initialize
  createControls();
  renderLineNumbersForAll();
  autoRefreshLoop();
})();
