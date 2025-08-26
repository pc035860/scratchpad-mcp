// Workflow 編輯功能 - 狀態切換和範圍編輯

// Workflow 編輯功能初始化
function initializeWorkflowEditing() {
  const workflowDetail = document.querySelector('.workflow-detail');
  if (!workflowDetail) return; // 只在詳細頁面執行

  const workflowId = workflowDetail.dataset.workflowId;
  if (!workflowId) return;

  // 狀態切換功能
  const statusToggle = document.querySelector('.status-toggle');
  if (statusToggle) {
    statusToggle.addEventListener('click', async () => {
      await toggleWorkflowStatus(workflowId, statusToggle);
    });
  }

  // Scope 編輯功能
  const scopeSelector = document.querySelector('.scope-selector');
  if (scopeSelector) {
    const scopeText = scopeSelector.querySelector('.scope-text');
    const scopeDropdown = scopeSelector.querySelector('.scope-dropdown');
    
    if (scopeText && scopeDropdown) {
      scopeSelector.addEventListener('click', () => {
        showScopeDropdown(scopeSelector, scopeText, scopeDropdown);
      });

      scopeDropdown.addEventListener('change', async (e) => {
        await updateWorkflowScope(workflowId, e.target.value, scopeSelector, scopeText, scopeDropdown);
      });

      // 點擊外部關閉下拉選單
      document.addEventListener('click', (e) => {
        if (!scopeSelector.contains(e.target)) {
          hideScopeDropdown(scopeText, scopeDropdown);
        }
      });
    }
  }
}

// 切換 workflow 狀態
async function toggleWorkflowStatus(workflowId, statusElement) {
  const currentStatus = statusElement.dataset.currentStatus === 'true';
  const newStatus = !currentStatus;
  
  showLoadingIndicator();
  
  try {
    const response = await fetch(`/api/workflow/${workflowId}/active`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isActive: newStatus })
    });

    if (!response.ok) {
      throw new Error('更新失敗');
    }

    const result = await response.json();
    
    // 更新 UI
    statusElement.dataset.currentStatus = newStatus.toString();
    statusElement.className = `meta-item status-toggle ${newStatus ? 'active' : 'inactive'}`;
    
    const statusIcon = statusElement.querySelector('.status-icon');
    const statusText = statusElement.querySelector('.status-text');
    
    if (statusIcon) statusIcon.textContent = newStatus ? '🟢' : '🔴';
    if (statusText) statusText.textContent = newStatus ? '啟用中' : '停用';
    
    // 更新時間戳
    updateTimestamp();
    
    // 顯示成功提示
    showSuccessMessage(result.message);
    
  } catch (error) {
    console.error('更新 workflow 狀態失敗:', error);
    showErrorMessage('更新失敗，請重試');
  } finally {
    hideLoadingIndicator();
  }
}

// 顯示 scope 下拉選單
function showScopeDropdown(scopeSelector, scopeText, scopeDropdown) {
  scopeText.style.display = 'none';
  scopeDropdown.style.display = 'block';
  scopeDropdown.focus();
}

// 隱藏 scope 下拉選單
function hideScopeDropdown(scopeText, scopeDropdown) {
  scopeText.style.display = 'inline-flex';
  scopeDropdown.style.display = 'none';
}

// 更新 workflow scope
async function updateWorkflowScope(workflowId, newScope, scopeSelector, scopeText, scopeDropdown) {
  const currentScope = scopeText.dataset.currentScope;
  if (newScope === currentScope) {
    hideScopeDropdown(scopeText, scopeDropdown);
    return;
  }
  
  showLoadingIndicator();
  
  try {
    const response = await fetch(`/api/workflow/${workflowId}/scope`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ projectScope: newScope || null })
    });

    if (!response.ok) {
      throw new Error('更新失敗');
    }

    const result = await response.json();
    
    // 更新 UI
    scopeText.dataset.currentScope = newScope;
    scopeText.textContent = newScope || '未分類';
    
    // 隱藏下拉選單
    hideScopeDropdown(scopeText, scopeDropdown);
    
    // 更新時間戳
    updateTimestamp();
    
    // 顯示成功提示
    showSuccessMessage(result.message);
    
  } catch (error) {
    console.error('更新 workflow scope 失敗:', error);
    showErrorMessage('更新失敗，請重試');
  } finally {
    hideLoadingIndicator();
  }
}

// 顯示載入指示器
function showLoadingIndicator() {
  const indicator = document.querySelector('.loading-indicator');
  if (indicator) indicator.style.display = 'flex';
}

// 隱藏載入指示器
function hideLoadingIndicator() {
  const indicator = document.querySelector('.loading-indicator');
  if (indicator) indicator.style.display = 'none';
}

// 更新時間戳
function updateTimestamp() {
  const updatedTime = document.querySelector('.updated-time');
  if (updatedTime) {
    const now = new Date();
    updatedTime.textContent = now.toLocaleString('zh-TW');
  }
}

// 顯示成功訊息
function showSuccessMessage(message) {
  showMessage(message, 'success');
}

// 顯示錯誤訊息  
function showErrorMessage(message) {
  showMessage(message, 'error');
}

// 通用訊息顯示
function showMessage(message, type) {
  const messageEl = document.createElement('div');
  messageEl.className = `message ${type}`;
  messageEl.textContent = message;
  messageEl.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 24px;
    border-radius: 8px;
    color: white;
    font-size: 14px;
    z-index: 1000;
    animation: slideIn 0.3s ease;
    background: ${type === 'success' ? '#10b981' : '#ef4444'};
  `;
  
  document.body.appendChild(messageEl);
  
  setTimeout(() => {
    messageEl.style.animation = 'slideOut 0.3s ease forwards';
    setTimeout(() => {
      document.body.removeChild(messageEl);
    }, 300);
  }, 3000);
}