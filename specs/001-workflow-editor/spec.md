# Spec 001: Web Workflow Viewer - Scratchpad 編輯與刪除功能

## 📋 概述

為 Web Workflow Viewer 新增直接編輯和刪除 scratchpad 的功能，提升使用者體驗和操作效率。

**建立日期**：2025-10-03
**狀態**：Draft
**優先級**：High

---

## 🎯 目標

1. ✅ 允許使用者直接在 web viewer 編輯 scratchpad 內容
2. ✅ 提供安全的 scratchpad 刪除功能（含確認機制）
3. ✅ 維持現有的即時更新機制
4. ✅ 確保操作簡單直觀，符合現有 UI/UX 風格

---

## 🔑 關鍵決策

### 1. 編輯器類型
**決策**：Inline Editor（方案 A）

**理由**：
- 簡單直觀，不需要額外 modal
- 適合快速修改和小幅調整
- 符合 MVP 優先原則

### 2. 權限控制
**決策**：所有 workflow 皆可編輯/刪除

**理由**：
- 不限制於 active workflow
- 提供更大的操作彈性
- 由前端 UI 明確標示當前狀態

### 3. 刪除確認機制
**決策**：使用 `prompt()` 提示輸入 scratchpad ID 前 6 碼

**理由**：
- 比簡單的 `confirm()` 更安全
- 避免誤刪重要內容
- 不需要額外的 modal 元件

**實作範例**：
```javascript
const scratchpadId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const confirmCode = scratchpadId.substring(0, 6); // "a1b2c3"

const userInput = prompt(
  `⚠️ 確定要刪除 scratchpad "${title}" 嗎？\n\n` +
  `此操作無法復原！\n\n` +
  `請輸入此 scratchpad ID 的前 6 碼以確認刪除：\n${confirmCode}`
);

if (userInput === confirmCode) {
  // 執行刪除
}
```

### 4. 即時更新機制
**決策**：利用現有的 SSE 機制自動更新

**理由**：
- 重用現有基礎設施
- 編輯/刪除後自動同步
- 不需要手動重新載入

---

## 🏗️ 架構設計

### 資料流向圖

```
[前端 UI]
    ↓ (用戶點擊編輯/刪除)
[JavaScript Event Handler]
    ↓ (fetch API)
[HTTP API Endpoint]
    ↓
[WorkflowDatabase Layer]
    ↓
[SQLite Database]
    ↓ (觸發器)
[FTS5 Index 自動更新]
    ↓ (SSE 推送)
[前端自動更新 UI]
```

---

## 📡 API 設計

### 1. 編輯 Scratchpad 內容

**Endpoint**：`PUT /api/scratchpad/:id/content`

**請求**：
```json
{
  "content": "新的 markdown 內容"
}
```

**回應（成功）**：
```json
{
  "success": true,
  "scratchpad": {
    "id": "xxx",
    "workflow_id": "yyy",
    "title": "標題",
    "content": "新內容",
    "updated_at": 1728048896,
    "created_at": 1728048800,
    "size_bytes": 1234
  },
  "message": "內容已更新"
}
```

**註**：`updated_at` 和 `created_at` 為 Unix timestamp（秒），符合現有資料庫 schema

**回應（失敗）**：
```json
{
  "error": "Scratchpad not found: xxx"
}
```

**狀態碼**：
- `200 OK`：更新成功
- `404 Not Found`：Scratchpad 不存在
- `500 Internal Server Error`：伺服器錯誤

### 2. 刪除 Scratchpad

**Endpoint**：`DELETE /api/scratchpad/:id`

**回應（成功）**：
```json
{
  "success": true,
  "message": "Scratchpad 已刪除"
}
```

**回應（失敗）**：
```json
{
  "error": "Scratchpad not found: xxx"
}
```

**狀態碼**：
- `200 OK`：刪除成功
- `404 Not Found`：Scratchpad 不存在
- `500 Internal Server Error`：伺服器錯誤

---

## 💾 資料庫層設計

### 新增方法：`deleteScratchpad(id: string)`

**檔案位置**：`src/database/ScratchpadDatabase.ts`

**實作重點**：
```typescript
deleteScratchpad(id: string): boolean {
  // 1. 檢查 scratchpad 存在性
  const existing = this.getScratchpadById(id);
  if (!existing) {
    throw new Error(`Scratchpad not found: ${id}`);
  }

  // 2. 執行刪除（FTS5 會透過觸發器自動清理）
  const stmt = this.db.prepare('DELETE FROM scratchpads WHERE id = ?');
  const result = stmt.run(id);

  // 3. 更新 workflow 時間戳（觸發 SSE 更新）
  this.updateWorkflowTimestamp.run(existing.workflow_id);

  return result.changes > 0;
}
```

**依賴的觸發器**（已存在）：
```sql
-- src/database/schema.ts:97-101
CREATE TRIGGER scratchpads_fts_delete
AFTER DELETE ON scratchpads
BEGIN
  DELETE FROM scratchpads_fts WHERE rowid = OLD.rowid;
END
```

### 調整方法：`updateScratchpadContent(id, newContent)`

**移除權限檢查**：
- 原本：只允許 active workflow 的 scratchpad 編輯
- 調整：所有 workflow 的 scratchpad 都可編輯

```typescript
updateScratchpadContent(id: string, newContent: string): Scratchpad {
  // 1. 檢查 scratchpad 存在性
  const existing = this.getScratchpadById(id);
  if (!existing) throw new Error(`Scratchpad not found: ${id}`);

  // ❌ 移除此檢查：
  // const workflow = this.getWorkflowById(existing.workflow_id);
  // if (!workflow || !workflow.is_active) {
  //   throw new Error('Cannot update scratchpad: workflow is not active');
  // }

  // 2. 計算新大小
  const newSizeBytes = Buffer.byteLength(newContent, 'utf8');

  // 3. 更新內容
  const transaction = this.db.transaction(() => {
    this.updateScratchpad.run(newContent, newSizeBytes, id);
    this.updateWorkflowTimestamp.run(existing.workflow_id);
  });

  transaction();

  return this.getScratchpadById(id);
}
```

---

## 🎨 前端 UI 設計

### 1. 按鈕佈局

在每個 `.scratchpad-item` 的 `.scratchpad-controls` 區域新增編輯和刪除按鈕：

```html
<div class="scratchpad-controls">
  <button class="btn-edit" data-scratchpad-id="xxx" data-scratchpad-title="標題" title="編輯內容">
    ✏️ 編輯
  </button>
  <button class="btn-delete" data-scratchpad-id="xxx" data-scratchpad-title="標題" title="刪除 scratchpad">
    🗑️ 刪除
  </button>
  <button class="btn-focus" data-scratchpad-id="xxx" title="專注檢視">
    👁️ 專注
  </button>
</div>
```

**事件綁定**：使用事件委派 (Event Delegation) 方式處理點擊事件

### 2. Inline Editor 狀態切換

**正常模式** → **編輯模式**：

**Before（正常顯示）**：
```html
<div class="markdown-with-lines" data-raw-b64="base64...">
  <div class="line-gutter">...</div>
  <div class="markdown-content">渲染後的 HTML</div>
</div>
```

**After（編輯模式）**：
```html
<div class="scratchpad-edit-mode">
  <textarea class="scratchpad-editor" rows="20">
    原始 markdown 內容
  </textarea>
  <div class="editor-actions">
    <button class="btn-save">💾 儲存</button>
    <button class="btn-cancel">❌ 取消</button>
  </div>
</div>
```

### 3. CSS 樣式

```css
/* 編輯器樣式 */
.scratchpad-editor {
  width: 100%;
  min-height: 400px;
  padding: 1rem;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.6;
  border: 2px solid var(--border-color);
  border-radius: 4px;
  resize: vertical;
}

/* 編輯模式容器 */
.scratchpad-edit-mode {
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: 4px;
}

/* 操作按鈕容器 */
.editor-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
  justify-content: flex-end;
}

/* 淡出動畫（刪除時使用） */
.scratchpad-item.fade-out {
  opacity: 0;
  transition: opacity 0.3s ease-out;
}
```

---

## 💻 前端實作細節

### 檔案結構

**新增檔案**：
- `scripts/serve-workflow/static/js/scratchpad-editor.js` - 編輯/刪除邏輯

**修改檔案**：
- `scripts/serve-workflow/templates/scratchpad-item.html` - 新增編輯/刪除按鈕
- `scripts/serve-workflow/static/css/main.css` - 新增編輯器樣式
- `scripts/serve-workflow/templates/layout.html` - 引入 `scratchpad-editor.js`

### 事件綁定初始化

```javascript
/**
 * 初始化 scratchpad 編輯與刪除事件（使用事件委派）
 */
function initializeScratchpadEditing() {
  const container = document.getElementById('scratchpads-container');
  if (!container) return;

  // 事件委派：處理所有編輯/刪除按鈕點擊
  container.addEventListener('click', async (e) => {
    // 編輯按鈕
    const editBtn = e.target.closest('.btn-edit');
    if (editBtn) {
      e.preventDefault();
      const scratchpadId = editBtn.dataset.scratchpadId;
      enterEditMode(scratchpadId);
      return;
    }

    // 刪除按鈕
    const deleteBtn = e.target.closest('.btn-delete');
    if (deleteBtn) {
      e.preventDefault();
      const scratchpadId = deleteBtn.dataset.scratchpadId;
      const scratchpadTitle = deleteBtn.dataset.scratchpadTitle || 'Untitled';
      await deleteScratchpad(scratchpadId, scratchpadTitle);
      return;
    }
  });
}

// DOM 準備完成後初始化
document.addEventListener('DOMContentLoaded', () => {
  initializeScratchpadEditing();
});
```

### 核心函數

#### 1. 編輯功能

```javascript
/**
 * 進入編輯模式
 */
function enterEditMode(scratchpadId) {
  const item = document.querySelector(
    `.scratchpad-item[data-scratchpad-id="${scratchpadId}"]`
  );

  // 取得原始內容
  const container = item.querySelector('.markdown-with-lines');
  const rawB64 = container.dataset.rawB64;
  const originalContent = atob(rawB64);

  // 建立編輯器 UI
  const editorHTML = `
    <div class="scratchpad-edit-mode">
      <textarea class="scratchpad-editor" rows="20">${escapeHtml(originalContent)}</textarea>
      <div class="editor-actions">
        <button class="btn-save" onclick="saveScratchpad('${scratchpadId}')">💾 儲存</button>
        <button class="btn-cancel" onclick="cancelEdit('${scratchpadId}')">❌ 取消</button>
      </div>
    </div>
  `;

  // 替換內容區
  container.outerHTML = editorHTML;

  // 自動聚焦
  item.querySelector('.scratchpad-editor').focus();
}

/**
 * 儲存編輯內容
 */
async function saveScratchpad(scratchpadId) {
  const item = document.querySelector(
    `.scratchpad-item[data-scratchpad-id="${scratchpadId}"]`
  );
  const textarea = item.querySelector('.scratchpad-editor');
  const newContent = textarea.value;

  try {
    // 顯示載入狀態
    textarea.disabled = true;

    // 發送 API 請求
    const response = await fetch(`/api/scratchpad/${scratchpadId}/content`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newContent })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '儲存失敗');
    }

    const result = await response.json();

    // 顯示成功訊息
    showToast('✅ 內容已儲存', 'success');

    // SSE 會自動更新 UI，這裡只需要退出編輯模式
    // 實際上 SSE 會重新渲染整個 scratchpad，所以不需要手動處理

  } catch (error) {
    showToast(`❌ 儲存失敗：${error.message}`, 'error');
    textarea.disabled = false;
  }
}

/**
 * 取消編輯
 */
function cancelEdit(scratchpadId) {
  // SSE 會自動恢復原始狀態，或手動觸發重新載入
  location.reload(); // 簡單方案
}
```

#### 2. 刪除功能

```javascript
/**
 * 刪除 scratchpad（含確認）
 */
async function deleteScratchpad(scratchpadId, title) {
  // 1. 取得確認碼（ID 前 6 碼）
  const confirmCode = scratchpadId.substring(0, 6);

  // 2. 提示使用者輸入確認碼
  const userInput = prompt(
    `⚠️ 確定要刪除 scratchpad "${title}" 嗎？\n\n` +
    `此操作無法復原！\n\n` +
    `請輸入此 scratchpad ID 的前 6 碼以確認刪除：\n${confirmCode}`
  );

  // 3. 驗證輸入
  if (userInput !== confirmCode) {
    if (userInput !== null) {
      showToast('❌ 確認碼不正確，已取消刪除', 'warning');
    }
    return;
  }

  try {
    // 4. 發送刪除請求
    const response = await fetch(`/api/scratchpad/${scratchpadId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '刪除失敗');
    }

    // 5. 從 DOM 移除（淡出動畫）
    const item = document.querySelector(
      `.scratchpad-item[data-scratchpad-id="${scratchpadId}"]`
    );
    item.classList.add('fade-out');

    setTimeout(() => {
      item.remove();
      showToast('🗑️ Scratchpad 已刪除', 'success');
    }, 300);

  } catch (error) {
    showToast(`❌ 刪除失敗：${error.message}`, 'error');
  }
}
```

#### 3. Toast 訊息系統

```javascript
/**
 * 顯示 toast 訊息
 */
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  document.body.appendChild(toast);

  // 淡入
  setTimeout(() => toast.classList.add('show'), 10);

  // 自動關閉
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
```

---

## 🔧 後端實作細節

### 檔案：`scripts/serve-workflow/server.js`

#### 1. WorkflowDatabase 類別擴充

在 `prepareStatements()` 新增：
```javascript
prepareStatements() {
  // ... 現有 statements ...

  // 新增：更新 scratchpad 內容
  this.updateScratchpadContentStmt = this.db.prepare(`
    UPDATE scratchpads
    SET content = ?,
        size_bytes = ?,
        updated_at = unixepoch()
    WHERE id = ?
  `);

  // 新增：刪除 scratchpad
  this.deleteScratchpadStmt = this.db.prepare(`
    DELETE FROM scratchpads WHERE id = ?
  `);
}
```

新增方法：
```javascript
// 更新 scratchpad 內容
updateScratchpadContent(id, newContent) {
  const existing = this.getScratchpadById(id);
  if (!existing) {
    throw new Error(`Scratchpad not found: ${id}`);
  }

  const newSizeBytes = Buffer.byteLength(newContent, 'utf8');

  const result = this.updateScratchpadContentStmt.run(
    newContent,
    newSizeBytes,
    id
  );

  // 更新 workflow 時間戳（觸發 SSE）
  const updateWorkflowStmt = this.db.prepare(`
    UPDATE workflows SET updated_at = unixepoch() WHERE id = ?
  `);
  updateWorkflowStmt.run(existing.workflow_id);

  return result.changes > 0;
}

// 刪除 scratchpad
deleteScratchpad(id) {
  const existing = this.getScratchpadById(id);
  if (!existing) {
    throw new Error(`Scratchpad not found: ${id}`);
  }

  const result = this.deleteScratchpadStmt.run(id);

  // 更新 workflow 時間戳（觸發 SSE）
  const updateWorkflowStmt = this.db.prepare(`
    UPDATE workflows SET updated_at = unixepoch() WHERE id = ?
  `);
  updateWorkflowStmt.run(existing.workflow_id);

  return result.changes > 0;
}

// 取得單一 scratchpad（新增輔助方法）
getScratchpadById(id) {
  const stmt = this.db.prepare(`
    SELECT * FROM scratchpads WHERE id = ?
  `);
  return stmt.get(id);
}
```

#### 2. API Handlers

```javascript
/**
 * PUT /api/scratchpad/:id/content
 * 更新 scratchpad 內容
 */
async function handleUpdateScratchpadContent(req, res, params) {
  try {
    const scratchpadId = params[1];

    // 讀取 request body
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    await new Promise(resolve => req.on('end', resolve));

    const { content } = JSON.parse(body);

    // 驗證參數
    if (typeof content !== 'string') {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'content 必須是字串' }));
      return;
    }

    // 執行更新
    workflowDB.updateScratchpadContent(scratchpadId, content);

    // 回傳更新後的 scratchpad
    const updated = workflowDB.getScratchpadById(scratchpadId);

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      success: true,
      scratchpad: updated,
      message: '內容已更新'
    }));

  } catch (error) {
    console.error('更新 scratchpad 內容失敗:', error);

    const statusCode = error.message.includes('not found') ? 404 : 500;
    res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: error.message }));
  }
}

/**
 * DELETE /api/scratchpad/:id
 * 刪除 scratchpad
 */
async function handleDeleteScratchpad(req, res, params) {
  try {
    const scratchpadId = params[1];

    // 執行刪除
    workflowDB.deleteScratchpad(scratchpadId);

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      success: true,
      message: 'Scratchpad 已刪除'
    }));

  } catch (error) {
    console.error('刪除 scratchpad 失敗:', error);

    const statusCode = error.message.includes('not found') ? 404 : 500;
    res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: error.message }));
  }
}
```

#### 3. 路由註冊

在路由註冊區域（約第 1228-1240 行）新增：

```javascript
// Scratchpad 編輯與刪除
router.addRoute('PUT', '^/api/scratchpad/([a-f0-9-]+)/content$', handleUpdateScratchpadContent);
router.addRoute('DELETE', '^/api/scratchpad/([a-f0-9-]+)$', handleDeleteScratchpad);
```

---

## 🧪 測試計畫

### 功能測試

#### 編輯功能
1. ✅ 正常編輯並儲存
2. ✅ 編輯後取消
3. ✅ 編輯不存在的 scratchpad（404）
4. ✅ 編輯 inactive workflow 的 scratchpad
5. ✅ 儲存空內容
6. ✅ 儲存超大內容（接近 1MB 限制）

#### 刪除功能
1. ✅ 正確輸入確認碼並刪除
2. ✅ 錯誤的確認碼（應取消）
3. ✅ 取消輸入（點擊 Cancel）
4. ✅ 刪除不存在的 scratchpad（404）
5. ✅ 刪除後 FTS5 索引自動清理

#### 即時更新
1. ✅ 編輯後透過 SSE 自動更新
2. ✅ 刪除後從列表移除
3. ✅ 多視窗同步更新

### 邊緣案例

1. ✅ 網路錯誤處理
2. ✅ 並發編輯衝突
3. ✅ 特殊字元處理（HTML、Markdown）
4. ✅ 超長標題顯示

---

## 📦 部署檢查清單

### 程式碼變更
- [ ] 資料庫層新增 `deleteScratchpad` 方法
- [ ] 資料庫層調整 `updateScratchpadContent`（移除 active 限制）
- [ ] 新增後端 API handlers
- [ ] 註冊新的 API 路由
- [ ] 新增前端 JavaScript (`scratchpad-editor.js`)
- [ ] 修改 HTML 模板（新增按鈕）
- [ ] 新增 CSS 樣式

### 測試驗證
- [ ] 單元測試通過
- [ ] 功能測試通過
- [ ] 邊緣案例測試通過
- [ ] 跨瀏覽器測試

### 文件更新
- [ ] 更新 README.md（新增功能說明）
- [ ] 更新 API 文件
- [ ] 更新使用者手冊

---

## 🚀 實作階段規劃

### Phase 1: 後端基礎（第 1 天）
- ✅ 資料庫層實作
- ✅ API handlers 實作
- ✅ 路由註冊
- ✅ 基礎測試

### Phase 2: 前端 UI（第 2 天）
- ✅ HTML/CSS 調整
- ✅ 編輯功能實作
- ✅ 刪除功能實作
- ✅ Toast 訊息系統

### Phase 3: 整合測試（第 3 天）
- ✅ 端到端測試
- ✅ 即時更新驗證
- ✅ 邊緣案例處理
- ✅ 效能測試

### Phase 4: 部署與文件（第 4 天）
- ✅ 文件更新
- ✅ 部署檢查
- ✅ 使用者驗收測試

---

## 📚 參考資料

### 相關檔案
- `src/database/ScratchpadDatabase.ts` - 資料庫層
- `src/database/schema.ts` - 資料庫 schema
- `scripts/serve-workflow/server.js` - Web server
- `scripts/serve-workflow/static/js/workflow-editor.js` - 現有編輯功能範例
- `scripts/serve-workflow/templates/scratchpad-item.html` - Scratchpad 模板

### 相關記憶
- `[scratchpad-mcp-v2]:enhanced_update_scratchpad_complete_implementation` - update-scratchpad MCP 工具實作
- `[scratchpad-mcp-v2]:serve_workflow_ui_fixes_2025_09_01` - Web UI 修復經驗
- `[scratchpad-mcp-v2]:line_editor_core_engine` - LineEditor 核心引擎

---

## 📝 備註

### 未來可能的增強功能
- 📝 Markdown 語法高亮編輯器
- 🔄 編輯歷史記錄與還原
- 👥 多人協作編輯
- 📱 行動裝置優化
- 🎨 自訂編輯器主題
- ⌨️ 鍵盤快捷鍵（Ctrl+S 儲存等）

### 已知限制
- 編輯器不支援即時預覽（未來可加入）
- 刪除確認使用原生 `prompt()`（體驗一般，但足夠安全）
- 並發編輯可能覆蓋（Last-Write-Wins，未來可考慮樂觀鎖）

---

**最後更新**：2025-10-03
**維護者**：pc035860
