// 主要前端邏輯 - Workflow Viewer

// 全域變數
let currentFilters = {
  search: '',
  projectScope: '',
  status: '',
  sort: 'updated_desc',
  page: 1,
  pageSize: 20
};

// DOM 準備完成後初始化
document.addEventListener('DOMContentLoaded', function() {
  initializeEventListeners();
  initializeUrlParameters();
});

function initializeEventListeners() {
  // 搜尋輸入防抖
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    let searchTimeout;
    searchInput.addEventListener('input', function(e) {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        currentFilters.search = e.target.value;
        currentFilters.page = 1;
        loadWorkflows();
      }, 300);
    });
  }

  // 搜尋按鈕
  const searchBtn = document.getElementById('search-btn');
  if (searchBtn) {
    searchBtn.addEventListener('click', function() {
      const searchInput = document.getElementById('search-input');
      if (searchInput) {
        currentFilters.search = searchInput.value;
        currentFilters.page = 1;
        loadWorkflows();
      }
    });
  }

  // 過濾器變更
  const filters = ['project-scope-filter', 'status-filter', 'sort-by', 'page-size'];
  filters.forEach(filterId => {
    const element = document.getElementById(filterId);
    if (element) {
      element.addEventListener('change', function(e) {
        const filterMap = {
          'project-scope-filter': 'projectScope',
          'status-filter': 'status',
          'sort-by': 'sort',
          'page-size': 'pageSize'
        };
        
        currentFilters[filterMap[filterId]] = e.target.value;
        currentFilters.page = 1;
        loadWorkflows();
      });
    }
  });

  // 分頁按鈕
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  
  if (prevBtn) {
    prevBtn.addEventListener('click', function() {
      if (currentFilters.page > 1) {
        currentFilters.page--;
        loadWorkflows();
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', function() {
      currentFilters.page++;
      loadWorkflows();
    });
  }

  // Scratchpad 搜尋（在詳細頁面）
  const scratchpadSearch = document.getElementById('scratchpad-search');
  if (scratchpadSearch) {
    let searchTimeout;
    scratchpadSearch.addEventListener('input', function(e) {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        filterScratchpads(e.target.value);
      }, 200);
    });
  }

  // Workflow 編輯功能（僅在詳細頁面）
  initializeWorkflowEditing();

  // 鍵盤快捷鍵
  document.addEventListener('keydown', function(e) {
    // / 鍵聚焦搜尋框
    if (e.key === '/' && e.target.tagName !== 'INPUT') {
      e.preventDefault();
      const searchInput = document.getElementById('search-input');
      if (searchInput) {
        searchInput.focus();
      }
    }
    
    // Esc 鍵清空搜尋
    if (e.key === 'Escape') {
      const searchInput = document.getElementById('search-input');
      if (searchInput && searchInput === document.activeElement) {
        searchInput.value = '';
        currentFilters.search = '';
        currentFilters.page = 1;
        loadWorkflows();
      }
    }
  });
}

function initializeUrlParameters() {
  // 從 URL 參數初始化過濾器（如果需要的話）
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('search')) {
    currentFilters.search = urlParams.get('search');
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = currentFilters.search;
  }
}

async function loadWorkflows() {
  const loading = document.getElementById('loading');
  const workflowGrid = document.getElementById('workflow-grid');
  
  if (loading) loading.style.display = 'block';
  if (workflowGrid) workflowGrid.style.opacity = '0.5';

  try {
    const params = new URLSearchParams(currentFilters);
    const response = await fetch('/api/workflows?' + params);
    
    if (!response.ok) {
      throw new Error('網路請求失敗');
    }

    const data = await response.json();
    updateWorkflowGrid(data.workflows);
    updatePagination(data.pagination);

  } catch (error) {
    console.error('載入 workflows 失敗:', error);
    if (workflowGrid) {
      workflowGrid.innerHTML = '<div class="error">載入失敗，請重試</div>';
    }
  } finally {
    if (loading) loading.style.display = 'none';
    if (workflowGrid) workflowGrid.style.opacity = '1';
  }
}

function updateWorkflowGrid(workflows) {
  const workflowGrid = document.getElementById('workflow-grid');
  if (!workflowGrid) return;

  if (workflows.length === 0) {
    workflowGrid.innerHTML = '<div class="empty-state">沒有找到符合條件的 workflow</div>';
    return;
  }

  workflowGrid.innerHTML = workflows.map(workflow => 
    createWorkflowCardHTML(workflow)
  ).join('');
}

function createWorkflowCardHTML(workflow) {
  return `
    <div class="workflow-card" data-workflow-id="${escapeHtml(workflow.id)}">
      <div class="card-header">
        <h3 class="card-title">📋 ${escapeHtml(workflow.name)}</h3>
        <div class="card-status ${workflow.is_active ? 'active' : 'inactive'}">
          ${workflow.is_active ? '🟢 啟用中' : '🔴 停用'}
        </div>
      </div>
      
      ${workflow.description ? `<p class="card-description">${escapeHtml(workflow.description)}</p>` : ''}
      
      <div class="card-metadata">
        <div class="metadata-item">
          🏷️ ${escapeHtml(workflow.project_scope || '未分類')}
        </div>
        <div class="metadata-item">
          📝 ${workflow.scratchpad_count} scratchpads
        </div>
        <div class="metadata-item">
          🕒 ${formatRelativeTime(workflow.updated_at)}
        </div>
      </div>
      
      <div class="card-actions">
        <a href="/workflow/${escapeHtml(workflow.id)}" class="view-btn">查看內容</a>
      </div>
    </div>
  `;
}

function updatePagination(pagination) {
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  const pageInfo = document.querySelector('.page-info');

  if (prevBtn) {
    prevBtn.disabled = pagination.page <= 1;
  }
  
  if (nextBtn) {
    nextBtn.disabled = pagination.page >= pagination.pages;
  }

  if (pageInfo) {
    pageInfo.textContent = `第 ${pagination.page} 頁，共 ${pagination.pages} 頁 (總共 ${pagination.total} 個 workflows)`;
  }
}

function filterScratchpads(searchTerm) {
  const scratchpads = document.querySelectorAll('.scratchpad-item');
  const searchLower = searchTerm.toLowerCase();

  scratchpads.forEach(scratchpad => {
    const title = scratchpad.dataset.title || '';
    const isMatch = title.toLowerCase().includes(searchLower);
    scratchpad.style.display = isMatch ? 'block' : 'none';
  });
}

// 輔助函數
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatRelativeTime(timestamp) {
  const now = Date.now();
  const time = timestamp * 1000; // 將 SQLite 的秒轉換為毫秒
  const diff = now - time;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days} 天前`;
  if (hours > 0) return `${hours} 小時前`;
  if (minutes > 0) return `${minutes} 分鐘前`;
  return '剛剛';
}