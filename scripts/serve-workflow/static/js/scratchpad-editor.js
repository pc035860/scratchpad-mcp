/**
 * Scratchpad Editor - 編輯與刪除功能
 *
 * 提供 inline 編輯和安全刪除功能
 */

/**
 * 初始化 scratchpad 編輯與刪除事件（使用事件委派）
 */
function initializeScratchpadEditing() {
  const container = document.getElementById('scratchpads-container');
  if (!container) return;

  // 事件委派：處理所有編輯/刪除/儲存/取消按鈕點擊
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

    // 儲存按鈕
    const saveBtn = e.target.closest('.btn-save');
    if (saveBtn) {
      e.preventDefault();
      const scratchpadId = saveBtn.dataset.scratchpadId;
      await saveScratchpad(scratchpadId);
      return;
    }

    // 取消按鈕
    const cancelBtn = e.target.closest('.btn-cancel');
    if (cancelBtn) {
      e.preventDefault();
      const scratchpadId = cancelBtn.dataset.scratchpadId;
      cancelEdit(scratchpadId);
      return;
    }
  });
}

/**
 * UTF-8 解碼輔助函數（與 viewer-controls.js 一致）
 */
function decodeRaw(b64) {
  try {
    return decodeURIComponent(escape(window.atob(b64)));
  } catch {
    // Fallback for UTF-8 decoding in older browsers
    return atob(b64);
  }
}

/**
 * 進入編輯模式
 */
function enterEditMode(scratchpadId) {
  const item = document.querySelector(`.scratchpad-item[data-scratchpad-id="${scratchpadId}"]`);
  if (!item) return;

  // 取得原始內容
  const container = item.querySelector('.markdown-with-lines');
  if (!container) return;

  const rawB64 = container.dataset.rawB64;
  if (!rawB64) return;

  const originalContent = decodeRaw(rawB64);

  // 儲存原始 HTML 到父層 item（因為 container 會被替換）
  item.dataset.originalMarkdownHtml = container.outerHTML;

  // 建立編輯器 UI
  const editorHTML = `
    <div class="scratchpad-edit-mode">
      <textarea class="scratchpad-editor" rows="20">${escapeHtml(originalContent)}</textarea>
      <div class="editor-actions">
        <button class="btn-save" data-scratchpad-id="${scratchpadId}">💾 儲存</button>
        <button class="btn-cancel" data-scratchpad-id="${scratchpadId}">❌ 取消</button>
      </div>
    </div>
  `;

  // 替換內容區
  container.outerHTML = editorHTML;

  // 自動聚焦
  const textarea = item.querySelector('.scratchpad-editor');
  if (textarea) {
    textarea.focus();
    // 移動游標到最後
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }
}

/**
 * 儲存編輯內容
 */
async function saveScratchpad(scratchpadId) {
  const item = document.querySelector(`.scratchpad-item[data-scratchpad-id="${scratchpadId}"]`);
  if (!item) return;

  const textarea = item.querySelector('.scratchpad-editor');
  if (!textarea) return;

  const newContent = textarea.value;

  try {
    // 顯示載入狀態
    textarea.disabled = true;
    const saveBtn = item.querySelector('.btn-save');
    if (saveBtn) saveBtn.disabled = true;

    // 發送 API 請求
    const response = await fetch(`/api/scratchpad/${scratchpadId}/content`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newContent }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '儲存失敗');
    }

    const result = await response.json();

    // 顯示成功訊息
    showToast('✅ 內容已儲存', 'success');

    // SSE 會自動更新 UI
    // 不需要手動處理，SSE 會重新渲染整個 scratchpad
  } catch (error) {
    showToast(`❌ 儲存失敗：${error.message}`, 'error');
    textarea.disabled = false;
    const saveBtn = item.querySelector('.btn-save');
    if (saveBtn) saveBtn.disabled = false;
  }
}

/**
 * 取消編輯
 */
function cancelEdit(scratchpadId) {
  const item = document.querySelector(`.scratchpad-item[data-scratchpad-id="${scratchpadId}"]`);
  if (!item) return;

  const editMode = item.querySelector('.scratchpad-edit-mode');
  if (!editMode) return;

  // 從父層 item 找回原始 HTML
  const originalHtml = item.dataset.originalMarkdownHtml;

  if (originalHtml) {
    // 恢復原始內容
    editMode.outerHTML = originalHtml;
    // 清理 dataset
    delete item.dataset.originalMarkdownHtml;
  } else {
    // 如果找不到原始內容，重新載入頁面
    location.reload();
  }
}

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
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '刪除失敗');
    }

    // 5. 從 DOM 移除（淡出動畫）
    const item = document.querySelector(`.scratchpad-item[data-scratchpad-id="${scratchpadId}"]`);
    if (item) {
      item.classList.add('fade-out');

      setTimeout(() => {
        item.remove();
        showToast('🗑️ Scratchpad 已刪除', 'success');
      }, 300);
    }
  } catch (error) {
    showToast(`❌ 刪除失敗：${error.message}`, 'error');
  }
}

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

/**
 * HTML 轉義函數
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// DOM 準備完成後初始化
document.addEventListener('DOMContentLoaded', () => {
  initializeScratchpadEditing();
});
