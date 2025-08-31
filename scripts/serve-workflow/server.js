#!/usr/bin/env node

/**
 * Workflow Viewer Server - 重構版本
 *
 * 一個簡單的 HTTP server，用於查看和瀏覽 scratchpad workflows
 * 支援搜尋、過濾、分頁等功能，並整合程式碼語法高亮
 *
 * 執行方式：
 * - npm run serve
 * - node scripts/serve-workflow/server.js
 * - node scripts/serve-workflow/server.js --port 3001 --dev
 *
 * 資料庫路徑設定（優先級：命令列 > 環境變數 > 預設值）：
 * - 預設：./scratchpad.v6.db
 * - 環境變數：export SCRATCHPAD_DB_PATH="/path/to/database.db"
 * - 命令列參數：--db-path "/path/to/database.db"
 *
 * 範例：
 * - SCRATCHPAD_DB_PATH="/var/data/scratchpad.db" npm run serve
 * - node scripts/serve-workflow/server.js --db-path "/tmp/test.db" --port 3001
 */

import http from 'http';
import url from 'url';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import Prism from 'prismjs';
// Tokenizer for token counting
import { encoding_for_model, get_encoding } from 'tiktoken';

// 載入 Prism.js 語言支援
import 'prismjs/components/prism-javascript.js';
import 'prismjs/components/prism-typescript.js';
import 'prismjs/components/prism-python.js';
import 'prismjs/components/prism-bash.js';
import 'prismjs/components/prism-json.js';
import 'prismjs/components/prism-css.js';
import 'prismjs/components/prism-sql.js';
import 'prismjs/components/prism-yaml.js';
// 注意：HTML 語法支援是 Prism.js 內建的，不需要額外載入

// ES 模組中取得 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置
const DEFAULT_PORT = 3000;

// 命令列參數解析
const args = process.argv.slice(2);
const port = getArgValue('--port') || DEFAULT_PORT;
const isDev = args.includes('--dev');

// 資料庫路徑設定 - 優先級：命令列參數 > 環境變數 > 預設值
const DB_PATH =
  getArgValue('--db-path') ||
  process.env.SCRATCHPAD_DB_PATH ||
  path.join(process.cwd(), 'scratchpad.v6.db');

console.log('🚀 Workflow Viewer Server');
console.log(`📁 資料庫位置: ${DB_PATH}`);
console.log(`🔧 開發模式: ${isDev ? '啟用' : '停用'}`);

// 資料庫路徑驗證
function validateDatabasePath(dbPath) {
  try {
    // 取得絕對路徑
    const absolutePath = path.resolve(dbPath);
    const parentDir = path.dirname(absolutePath);

    // 檢查父目錄是否存在
    if (!fs.existsSync(parentDir)) {
      console.error(`❌ 資料庫父目錄不存在: ${parentDir}`);
      process.exit(1);
    }

    // 檢查父目錄是否可寫
    try {
      fs.accessSync(parentDir, fs.constants.W_OK);
    } catch (err) {
      console.error(`❌ 資料庫父目錄沒有寫入權限: ${parentDir}`);
      process.exit(1);
    }

    // 檢查資料庫檔案是否存在
    if (!fs.existsSync(absolutePath)) {
      console.error('❌ 資料庫檔案不存在！請先運行 MCP server 建立資料庫');
      console.error(`   資料庫路徑: ${absolutePath}`);
      process.exit(1);
    }

    return absolutePath;
  } catch (err) {
    console.error(`❌ 資料庫路徑無效: ${dbPath}`);
    console.error(`   錯誤詳情: ${err.message}`);
    process.exit(1);
  }
}

// 驗證並取得最終資料庫路徑
const VALIDATED_DB_PATH = validateDatabasePath(DB_PATH);

// 初始化資料庫連接
const db = new Database(VALIDATED_DB_PATH, { readonly: false });

// --- Token encoder initialization and cache ---
const TIKTOKEN_MODEL = process.env.TIKTOKEN_MODEL || null;
let __tokenEncoder = null; // encoder instance or false when unavailable
const __tokenCache = new Map(); // key: `${id}:${updated_at}` -> number

function getTokenEncoder() {
  if (__tokenEncoder !== null) return __tokenEncoder;
  try {
    __tokenEncoder = TIKTOKEN_MODEL
      ? encoding_for_model(TIKTOKEN_MODEL)
      : get_encoding('cl100k_base');
  } catch (e) {
    console.warn('⚠️ 無法初始化 tiktoken 編碼器，將略過 token 顯示：', e?.message || e);
    __tokenEncoder = false;
  }
  return __tokenEncoder;
}

function getTokenCountForScratchpad(content, id, updatedAt) {
  try {
    if (!content || !id || !updatedAt) return null;
    const key = `${id}:${updatedAt}`;
    if (__tokenCache.has(key)) return __tokenCache.get(key);
    const enc = getTokenEncoder();
    if (!enc) return null;
    const count = enc.encode(String(content)).length;
    __tokenCache.set(key, count);
    return count;
  } catch {
    return null;
  }
}

function formatTokenCompact(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs < 1000) return `${sign}${abs}`;
  const units = [
    { v: 1e9, s: 'B' },
    { v: 1e6, s: 'M' },
    { v: 1e3, s: 'k' },
  ];
  for (const u of units) {
    if (abs >= u.v) {
      const val = (abs / u.v).toFixed(1);
      return `${sign}${val.endsWith('.0') ? val.slice(0, -2) : val}${u.s}`;
    }
  }
  return `${sign}${abs}`;
}

function renderTokenBadge(count) {
  if (typeof count !== 'number') return '';
  const label = formatTokenCompact(count);
  return `<div class="token-badge" aria-label="Token count" title="${count} tokens">${label}</div>`;
}

// 設定 marked 選項並整合 Prism.js
marked.setOptions({
  gfm: true,
  breaks: true,
  pedantic: false,
  sanitize: false,
  smartLists: true,
  smartypants: true,
});

// 使用 marked-highlight 擴展整合 Prism.js
marked.use(
  markedHighlight({
    langPrefix: 'language-',
    highlight: function (code, language) {
      if (language && Prism.languages[language]) {
        try {
          return Prism.highlight(code, Prism.languages[language], language);
        } catch (e) {
          console.warn(`語法高亮失敗 (${language}):`, e.message);
        }
      }
      return code;
    },
  })
);

/**
 * 模板引擎類別
 */
class TemplateEngine {
  constructor(templateDir) {
    this.templateDir = templateDir;
    this.cache = new Map();
  }

  loadTemplate(name) {
    if (this.cache.has(name)) {
      return this.cache.get(name);
    }

    try {
      const templatePath = path.join(this.templateDir, `${name}.html`);
      const template = fs.readFileSync(templatePath, 'utf-8');
      this.cache.set(name, template);
      return template;
    } catch (error) {
      throw new Error(`模板載入失敗: ${name} - ${error.message}`);
    }
  }

  render(templateName, data = {}) {
    const template = this.loadTemplate(templateName);
    return this.interpolate(template, data);
  }

  interpolate(template, data) {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const value = this.getNestedValue(data, key.trim());
      return value !== undefined ? value : match;
    });
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }
}

const templates = new TemplateEngine(path.join(__dirname, 'templates'));

/**
 * 資料庫查詢類別
 */
class WorkflowDatabase {
  constructor(database) {
    this.db = database;
    this.prepareStatements();
  }

  prepareStatements() {
    // 獲取 workflow 列表（支援搜尋、過濾、分頁、排序）
    this.getWorkflowsStmt = this.db.prepare(`
      SELECT w.*, 
             COUNT(s.id) as scratchpad_count
      FROM workflows w 
      LEFT JOIN scratchpads s ON w.id = s.workflow_id 
      WHERE 1=1
        AND (? IS NULL OR w.name LIKE ? OR w.description LIKE ?)
        AND (? IS NULL OR w.project_scope = ?)
        AND (? IS NULL OR w.is_active = ?)
      GROUP BY w.id 
      ORDER BY 
        CASE WHEN ? = 'updated_desc' THEN w.updated_at END DESC,
        CASE WHEN ? = 'created_desc' THEN w.created_at END DESC,
        CASE WHEN ? = 'name_asc' THEN w.name END ASC,
        CASE WHEN ? = 'scratchpad_count_desc' THEN COUNT(s.id) END DESC,
        w.updated_at DESC
      LIMIT ? OFFSET ?
    `);

    // 計算總數
    this.countWorkflowsStmt = this.db.prepare(`
      SELECT COUNT(DISTINCT w.id) as total
      FROM workflows w 
      WHERE 1=1
        AND (? IS NULL OR w.name LIKE ? OR w.description LIKE ?)
        AND (? IS NULL OR w.project_scope = ?)
        AND (? IS NULL OR w.is_active = ?)
    `);

    // 獲取單個 workflow
    this.getWorkflowStmt = this.db.prepare(`
      SELECT w.*, COUNT(s.id) as scratchpad_count
      FROM workflows w 
      LEFT JOIN scratchpads s ON w.id = s.workflow_id 
      WHERE w.id = ?
      GROUP BY w.id
    `);

    // 獲取 workflow 的 scratchpads
    this.getScratchpadsStmt = this.db.prepare(`
      SELECT * FROM scratchpads 
      WHERE workflow_id = ? 
      ORDER BY created_at ASC
    `);

    // 獲取所有 project scopes
    this.getProjectScopesStmt = this.db.prepare(`
      SELECT project_scope, COUNT(*) as count
      FROM workflows 
      GROUP BY project_scope
      ORDER BY count DESC, project_scope ASC
    `);

    // 統計資訊
    this.getStatsStmt = this.db.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM workflows) as total_workflows,
        (SELECT COUNT(*) FROM workflows WHERE is_active = 1) as active_workflows,
        (SELECT COUNT(*) FROM scratchpads) as total_scratchpads,
        (SELECT COUNT(DISTINCT project_scope) FROM workflows WHERE project_scope IS NOT NULL) as total_projects
    `);
    // 取得最新 scratchpad 更新時間
    this.getLatestScratchpadTimeStmt = this.db.prepare(`
      SELECT MAX(updated_at) AS latest FROM scratchpads WHERE workflow_id = ?
    `);
  }

  getWorkflows(options = {}) {
    const {
      search = null,
      projectScope = null,
      status = null,
      sort = 'updated_desc',
      limit = 20,
      offset = 0,
    } = options;

    const searchPattern = search ? `%${search}%` : null;
    const statusValue = status === 'active' ? 1 : status === 'inactive' ? 0 : null;

    const workflows = this.getWorkflowsStmt.all(
      searchPattern,
      searchPattern,
      searchPattern,
      projectScope,
      projectScope,
      statusValue,
      statusValue,
      sort,
      sort,
      sort,
      sort,
      limit,
      offset
    );

    const total = this.countWorkflowsStmt.get(
      searchPattern,
      searchPattern,
      searchPattern,
      projectScope,
      projectScope,
      statusValue,
      statusValue
    ).total;

    return { workflows, total };
  }

  getWorkflowById(id) {
    const workflow = this.getWorkflowStmt.get(id);
    if (!workflow) return null;
    workflow.is_active = Boolean(workflow.is_active);
    return workflow;
  }

  getScratchpadsByWorkflowId(workflowId) {
    return this.getScratchpadsStmt.all(workflowId);
  }

  getScratchpadById(id) {
    try {
      // 懶載入：若尚未準備，建立一次性 statement
      if (!this.getScratchpadByIdStmt) {
        this.getScratchpadByIdStmt = this.db.prepare('SELECT * FROM scratchpads WHERE id = ?');
      }
      return this.getScratchpadByIdStmt.get(id) || null;
    } catch {
      return null;
    }
  }

  getProjectScopes() {
    return this.getProjectScopesStmt.all();
  }

  getStats() {
    return this.getStatsStmt.get();
  }

  getScratchpadSummary(id) {
    const s = this.getScratchpadById(id);
    if (!s) return null;
    return {
      scratchpad_id: s.id,
      updated_at: s.updated_at,
      size_bytes: s.size_bytes,
      workflow_id: s.workflow_id,
    };
  }

  // 輕量摘要：供 JSON/SSE 判斷是否有更新
  getWorkflowSummary(id) {
    const w = this.getWorkflowById(id);
    if (!w) return null;
    const row = this.getLatestScratchpadTimeStmt.get(id);
    const latestScratchpadAt = row && row.latest ? row.latest : null;
    return {
      workflow_id: w.id,
      updated_at: w.updated_at,
      scratchpad_count: w.scratchpad_count,
      latest_scratchpad_at: latestScratchpadAt,
    };
  }

  // 更新 workflow 啟用狀態
  updateWorkflowActive(id, isActive) {
    const updateStmt = this.db.prepare(`
      UPDATE workflows 
      SET is_active = ?, updated_at = unixepoch() 
      WHERE id = ?
    `);
    const result = updateStmt.run(isActive ? 1 : 0, id);
    return result.changes > 0;
  }

  // 更新 workflow project scope
  updateWorkflowScope(id, projectScope) {
    const updateStmt = this.db.prepare(`
      UPDATE workflows 
      SET project_scope = ?, updated_at = unixepoch() 
      WHERE id = ?
    `);
    const result = updateStmt.run(projectScope || null, id);
    return result.changes > 0;
  }
}

const workflowDB = new WorkflowDatabase(db);

/**
 * HTTP 路由處理
 */
class Router {
  constructor() {
    this.routes = new Map();
  }

  addRoute(method, pattern, handler) {
    const key = `${method}:${pattern}`;
    this.routes.set(key, { pattern: new RegExp(pattern), handler });
  }

  findRoute(method, pathname) {
    const key = `${method}:`;
    for (const [routeKey, route] of this.routes) {
      if (routeKey.startsWith(key)) {
        const match = pathname.match(route.pattern);
        if (match) {
          return { handler: route.handler, params: match };
        }
      }
    }
    return null;
  }
}

const router = new Router();

/**
 * 靜態檔案處理
 */
async function handleStaticFile(req, res, pathname) {
  try {
    const filePath = path.join(__dirname, pathname);

    // 安全檢查：防止路徑遍歷攻擊
    const normalizedPath = path.normalize(filePath);
    if (!normalizedPath.startsWith(__dirname)) {
      return handleNotFound(res, '檔案不存在');
    }

    const stats = fs.statSync(filePath);
    if (!stats.isFile()) {
      return handleNotFound(res, '檔案不存在');
    }

    // 設定 Content-Type
    const ext = path.extname(filePath).toLowerCase();
    const contentTypes = {
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.html': 'text/html; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
    };

    const contentType = contentTypes[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': isDev ? 'no-cache' : 'public, max-age=3600',
    });

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    if (error.code === 'ENOENT') {
      handleNotFound(res, '檔案不存在');
    } else {
      console.error('靜態檔案處理錯誤:', error);
      handleError(res, '檔案讀取錯誤', error.message);
    }
  }
}

/**
 * 路由處理函數
 */
async function handleHomepage(req, res, params) {
  try {
    const query = url.parse(req.url, true).query;
    const options = {
      search: query.search || null,
      projectScope: query.projectScope || null,
      status: query.status || null,
      sort: query.sort || 'updated_desc',
      limit: parseInt(query.pageSize) || 20,
      offset: ((parseInt(query.page) || 1) - 1) * (parseInt(query.pageSize) || 20),
    };

    const { workflows, total } = workflowDB.getWorkflows(options);
    const projectScopes = workflowDB.getProjectScopes();
    const stats = workflowDB.getStats();

    const pagination = {
      page: parseInt(query.page) || 1,
      pages: Math.ceil(total / options.limit),
      total,
      limit: options.limit,
    };

    // 轉換 workflows 資料
    workflows.forEach((w) => (w.is_active = Boolean(w.is_active)));

    // 準備模板資料
    const templateData = {
      title: 'Workflow Viewer',
      stats,
      projectScopeOptions: projectScopes
        .map(
          (scope) =>
            `<option value="${escapeHtml(scope.project_scope || '')}">${escapeHtml(scope.project_scope || '未分類')} (${scope.count})</option>`
        )
        .join(''),
      workflowCards: workflows
        .map((workflow) => {
          const cardData = {
            workflow: {
              id: escapeHtml(workflow.id),
              name: escapeHtml(workflow.name),
              statusClass: workflow.is_active ? 'active' : 'inactive',
              statusText: workflow.is_active ? '🟢 啟用中' : '🔴 停用',
              descriptionHtml: workflow.description
                ? `<p class="card-description">${escapeHtml(workflow.description)}</p>`
                : '',
              projectScopeDisplay: escapeHtml(workflow.project_scope || '未分類'),
              scratchpad_count: workflow.scratchpad_count,
              relativeTime: formatRelativeTime(workflow.updated_at),
            },
          };
          return templates.render('workflow-card', cardData);
        })
        .join(''),
      pagination,
      prevDisabled: pagination.page <= 1 ? 'disabled' : '',
      nextDisabled: pagination.page >= pagination.pages ? 'disabled' : '',
    };

    const content = templates.render('homepage', templateData);
    const html = templates.render('layout', {
      title: 'Workflow Viewer',
      content,
      additionalHead: '',
    });

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  } catch (error) {
    console.error('首頁處理錯誤:', error);
    handleError(res, '內部伺服器錯誤', error.message);
  }
}

async function handleWorkflowDetail(req, res, params) {
  try {
    const workflowId = params[1];

    const workflow = workflowDB.getWorkflowById(workflowId);
    if (!workflow) {
      handleNotFound(res, 'Workflow 不存在');
      return;
    }

    const scratchpads = workflowDB.getScratchpadsByWorkflowId(workflowId);
    const projectScopes = workflowDB.getProjectScopes();

    // 準備模板資料
    const templateData = {
      title: workflow.name,
      workflow: {
        id: escapeHtml(workflow.id),
        name: escapeHtml(workflow.name),
        is_active: workflow.is_active,
        statusClass: workflow.is_active ? 'active' : 'inactive',
        statusIcon: workflow.is_active ? '🟢' : '🔴',
        statusText: workflow.is_active ? '啟用中' : '停用',
        project_scope: escapeHtml(workflow.project_scope || ''),
        projectScopeDisplay: escapeHtml(workflow.project_scope || '未分類'),
        createdTime: formatTimestamp(workflow.created_at),
        updatedTime: formatTimestamp(workflow.updated_at),
        updatedAt: escapeHtml(String(workflow.updated_at || '')),
        descriptionHtml: workflow.description
          ? `<p class="workflow-description">${escapeHtml(workflow.description)}</p>`
          : '',
      },
      projectScopeOptions: projectScopes
        .map(
          (scope) =>
            `<option value="${escapeHtml(scope.project_scope || '')}" ${(scope.project_scope || '') === (workflow.project_scope || '') ? 'selected' : ''}>${escapeHtml(scope.project_scope || '未分類')} (${scope.count})</option>`
        )
        .join(''),
      scratchpadCount: scratchpads.length,
      scratchpadSearchHtml:
        scratchpads.length > 1
          ? '<input type="text" id="scratchpad-search" placeholder="搜尋 scratchpad 標題..." class="scratchpad-search">'
          : '',
      scratchpadItems: scratchpads
        .map((scratchpad) => {
          const lineCount =
            typeof scratchpad.content === 'string' ? scratchpad.content.split('\n').length : 0;
          const rawB64 = Buffer.from(String(scratchpad.content || ''), 'utf8').toString('base64');
          const itemData = {
            scratchpad: {
              id: escapeHtml(scratchpad.id),
              title: escapeHtml(scratchpad.title),
              sizeDisplay: formatBytes(scratchpad.size_bytes),
              relativeTime: formatRelativeTime(scratchpad.updated_at),
              lineCount,
              rawB64: rawB64,
              contentHtml: marked(scratchpad.content),
            },
          };
          return templates.render('scratchpad-item', itemData);
        })
        .join(''),
    };

    const content = templates.render('workflow-detail', templateData);
    const html = templates.render('layout', {
      title: `${workflow.name} - Workflow`,
      content,
      additionalHead: '',
    });

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  } catch (error) {
    console.error('Workflow 詳細頁面錯誤:', error);
    handleError(res, '內部伺服器錯誤', error.message);
  }
}

// 產生 scratchpads 容器 HTML 片段
function renderScratchpadsContainerHTML(workflowId) {
  const workflow = workflowDB.getWorkflowById(workflowId);
  if (!workflow) return null;
  const scratchpads = workflowDB.getScratchpadsByWorkflowId(workflowId);
  const scratchpadItems = scratchpads
    .map((scratchpad) => {
      const lineCount =
        typeof scratchpad.content === 'string' ? scratchpad.content.split('\n').length : 0;
      const rawB64 = Buffer.from(String(scratchpad.content || ''), 'utf8').toString('base64');
      const tokenCount = getTokenCountForScratchpad(
        scratchpad.content,
        scratchpad.id,
        scratchpad.updated_at
      );
      const itemData = {
        scratchpad: {
          id: escapeHtml(scratchpad.id),
          title: escapeHtml(scratchpad.title),
          sizeDisplay: formatBytes(scratchpad.size_bytes),
          relativeTime: formatRelativeTime(scratchpad.updated_at),
          lineCount,
          rawB64,
          contentHtml: marked(scratchpad.content),
          tokenBadge: renderTokenBadge(tokenCount),
        },
      };
      return templates.render('scratchpad-item', itemData);
    })
    .join('');
  return `<div class="scratchpads-container" id="scratchpads-container">${scratchpadItems}</div>`;
}

// API: Workflow 摘要
async function handleApiWorkflowSummary(req, res, params) {
  try {
    const workflowId = params[1];
    const summary = workflowDB.getWorkflowSummary(workflowId);
    if (!summary) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Workflow 不存在' }));
      return;
    }
    const query = url.parse(req.url, true).query;
    const since = query.since ? Number(query.since) : null;
    const etag = `W/\"${summary.updated_at}\"`;
    const ifNoneMatch = req.headers['if-none-match'];

    let changed = true;
    if (since !== null && !Number.isNaN(since)) {
      changed = summary.updated_at > since;
    }
    if (ifNoneMatch && ifNoneMatch === etag) {
      changed = false;
    }
    if (!changed) {
      res.writeHead(304, { ETag: etag });
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', ETag: etag });
    res.end(JSON.stringify({ ...summary, changed: true }));
  } catch (error) {
    console.error('API workflow 摘要錯誤:', error);
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: '內部伺服器錯誤' }));
  }
}

// API: 取得 scratchpads 容器 HTML 片段
async function handleApiWorkflowScratchpads(req, res, params) {
  try {
    const workflowId = params[1];
    const html = renderScratchpadsContainerHTML(workflowId);
    if (!html) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Workflow 不存在');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  } catch (error) {
    console.error('API scratchpads 片段錯誤:', error);
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('內部伺服器錯誤');
  }
}

// 產生單一 scratchpad 項目 HTML
function renderSingleScratchpadHTML(scratchpadId) {
  const s = workflowDB.getScratchpadById(scratchpadId);
  if (!s) return null;
  const lineCount = typeof s.content === 'string' ? s.content.split('\n').length : 0;
  const rawB64 = Buffer.from(String(s.content || ''), 'utf8').toString('base64');
  const tokenCount = getTokenCountForScratchpad(s.content, s.id, s.updated_at);
  const itemData = {
    scratchpad: {
      id: escapeHtml(s.id),
      title: escapeHtml(s.title),
      sizeDisplay: formatBytes(s.size_bytes),
      relativeTime: formatRelativeTime(s.updated_at),
      lineCount,
      rawB64,
      contentHtml: marked(s.content),
      tokenBadge: renderTokenBadge(tokenCount),
    },
  };
  return templates.render('scratchpad-item', itemData);
}

// API: Scratchpad 摘要
async function handleApiScratchpadSummary(req, res, params) {
  try {
    const scratchpadId = params[1];
    const summary = workflowDB.getScratchpadSummary(scratchpadId);
    if (!summary) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Scratchpad 不存在' }));
      return;
    }
    const query = url.parse(req.url, true).query;
    const since = query.since ? Number(query.since) : null;
    const etag = `W/\"${summary.updated_at}\"`;
    const ifNoneMatch = req.headers['if-none-match'];
    let changed = true;
    if (since !== null && !Number.isNaN(since)) changed = summary.updated_at > since;
    if (ifNoneMatch && ifNoneMatch === etag) changed = false;
    if (!changed) {
      res.writeHead(304, { ETag: etag });
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', ETag: etag });
    res.end(JSON.stringify({ ...summary, changed: true }));
  } catch (error) {
    console.error('API scratchpad 摘要錯誤:', error);
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: '內部伺服器錯誤' }));
  }
}

// API: 單一 scratchpad HTML 片段
async function handleApiScratchpadHtml(req, res, params) {
  try {
    const scratchpadId = params[1];
    const html = renderSingleScratchpadHTML(scratchpadId);
    if (!html) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Scratchpad 不存在');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  } catch (error) {
    console.error('API scratchpad HTML 片段錯誤:', error);
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('內部伺服器錯誤');
  }
}

// SSE: 單一 scratchpad 更新
async function handleSSEScratchpad(req, res, params) {
  try {
    const scratchpadId = params[1];
    const summary = workflowDB.getScratchpadSummary(scratchpadId);
    if (!summary) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Scratchpad 不存在');
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    let last = summary.updated_at;
    res.write(`event: update\n`);
    res.write(`data: ${JSON.stringify({ scratchpad_id: scratchpadId, updated_at: last })}\n\n`);
    const timer = setInterval(() => {
      try {
        const s = workflowDB.getScratchpadSummary(scratchpadId);
        if (s && s.updated_at !== last) {
          last = s.updated_at;
          res.write(`event: update\n`);
          res.write(
            `data: ${JSON.stringify({ scratchpad_id: scratchpadId, updated_at: last })}\n\n`
          );
        } else {
          res.write(`: ping\n\n`);
        }
      } catch (e) {
        clearInterval(timer);
        try {
          res.end();
        } catch {}
      }
    }, 5000);
    req.on('close', () => clearInterval(timer));
  } catch (error) {
    console.error('SSE scratchpad 錯誤:', error);
    try {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    } catch {}
    try {
      res.end('內部伺服器錯誤');
    } catch {}
  }
}

// SSE: workflow 更新推播
async function handleSSEWorkflow(req, res, params) {
  try {
    const workflowId = params[1];
    const summary = workflowDB.getWorkflowSummary(workflowId);
    if (!summary) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Workflow 不存在');
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    let last = summary.updated_at;
    // 初始事件
    res.write(`event: update\n`);
    res.write(`data: ${JSON.stringify({ workflow_id: workflowId, updated_at: last })}\n\n`);

    const timer = setInterval(() => {
      try {
        const s = workflowDB.getWorkflowSummary(workflowId);
        if (s && s.updated_at !== last) {
          last = s.updated_at;
          res.write(`event: update\n`);
          res.write(`data: ${JSON.stringify({ workflow_id: workflowId, updated_at: last })}\n\n`);
        } else {
          res.write(`: ping\n\n`);
        }
      } catch (e) {
        clearInterval(timer);
        try {
          res.end();
        } catch {}
      }
    }, 5000);

    req.on('close', () => {
      clearInterval(timer);
    });
  } catch (error) {
    console.error('SSE workflow 錯誤:', error);
    try {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    } catch {}
    try {
      res.end('內部伺服器錯誤');
    } catch {}
  }
}

async function handleApiWorkflows(req, res, params) {
  try {
    const query = url.parse(req.url, true).query;
    const options = {
      search: query.search || null,
      projectScope: query.projectScope || null,
      status: query.status || null,
      sort: query.sort || 'updated_desc',
      limit: parseInt(query.pageSize) || 20,
      offset: ((parseInt(query.page) || 1) - 1) * (parseInt(query.pageSize) || 20),
    };

    const { workflows, total } = workflowDB.getWorkflows(options);

    // 轉換 is_active 為布林值
    workflows.forEach((w) => (w.is_active = Boolean(w.is_active)));

    const pagination = {
      page: parseInt(query.page) || 1,
      pages: Math.ceil(total / options.limit),
      total,
      limit: options.limit,
    };

    const response = { workflows, pagination };

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(response));
  } catch (error) {
    console.error('API workflows 錯誤:', error);
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: '內部伺服器錯誤' }));
  }
}

async function handleApiProjectScopes(req, res, params) {
  try {
    const scopes = workflowDB.getProjectScopes();

    const response = {
      scopes: scopes.map((scope) => ({
        value: scope.project_scope,
        label: scope.project_scope || '未分類',
        count: scope.count,
      })),
    };

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(response));
  } catch (error) {
    console.error('API project scopes 錯誤:', error);
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: '內部伺服器錯誤' }));
  }
}

// 處理 workflow 啟用狀態更新
async function handleUpdateWorkflowActive(req, res, params) {
  try {
    const workflowId = params[1];

    if (req.method !== 'PUT') {
      res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: '方法不允許' }));
      return;
    }

    // 讀取請求body
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    await new Promise((resolve) => {
      req.on('end', resolve);
    });

    let requestData;
    try {
      requestData = JSON.parse(body);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: '無效的 JSON 格式' }));
      return;
    }

    const { isActive } = requestData;
    if (typeof isActive !== 'boolean') {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'isActive 必須是布林值' }));
      return;
    }

    const success = workflowDB.updateWorkflowActive(workflowId, isActive);
    if (!success) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Workflow 不存在' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(
      JSON.stringify({
        success: true,
        isActive,
        message: `Workflow ${isActive ? '已啟用' : '已停用'}`,
      })
    );
  } catch (error) {
    console.error('更新 workflow 狀態錯誤:', error);
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: '內部伺服器錯誤' }));
  }
}

// 處理 workflow scope 更新
async function handleUpdateWorkflowScope(req, res, params) {
  try {
    const workflowId = params[1];

    if (req.method !== 'PUT') {
      res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: '方法不允許' }));
      return;
    }

    // 讀取請求body
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    await new Promise((resolve) => {
      req.on('end', resolve);
    });

    let requestData;
    try {
      requestData = JSON.parse(body);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: '無效的 JSON 格式' }));
      return;
    }

    const { projectScope } = requestData;
    if (projectScope !== null && typeof projectScope !== 'string') {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'projectScope 必須是字串或 null' }));
      return;
    }

    const success = workflowDB.updateWorkflowScope(workflowId, projectScope);
    if (!success) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Workflow 不存在' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(
      JSON.stringify({
        success: true,
        projectScope: projectScope || null,
        message: `Workflow scope 已更新為 ${projectScope || '未分類'}`,
      })
    );
  } catch (error) {
    console.error('更新 workflow scope 錯誤:', error);
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: '內部伺服器錯誤' }));
  }
}

async function handleHealth(req, res, params) {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: 'connected',
  };

  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(health));
}

function handleNotFound(res, message = 'Workflow 不存在') {
  const templateData = {
    title: '404 - 找不到頁面',
    message: escapeHtml(message),
  };

  const content = templates.render('error', templateData);
  const html = templates.render('layout', { title: '404 錯誤', content, additionalHead: '' });

  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

function handleError(res, title, message) {
  const templateData = {
    title: escapeHtml(title),
    message: escapeHtml(message),
  };

  const content = templates.render('error', templateData);
  const html = templates.render('layout', { title: '錯誤', content, additionalHead: '' });

  res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

/**
 * 輔助函數
 */
function getArgValue(arg) {
  const index = args.indexOf(arg);
  return index !== -1 && args[index + 1] ? args[index + 1] : null;
}

function parseTimestamp(timestamp) {
  return new Date(timestamp * 1000);
}

function formatTimestamp(timestamp, locale = 'zh-TW') {
  return parseTimestamp(timestamp).toLocaleString(locale);
}

function escapeHtml(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatRelativeTime(timestamp) {
  const now = Date.now();
  const time = timestamp * 1000;
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

/**
 * 註冊路由
 */
router.addRoute('GET', '^/$', handleHomepage);
router.addRoute('GET', '^/workflow/([a-f0-9-]+)$', handleWorkflowDetail);
router.addRoute('GET', '^/api/workflows$', handleApiWorkflows);
router.addRoute('GET', '^/api/project-scopes$', handleApiProjectScopes);
router.addRoute('GET', '^/api/workflow/([a-f0-9-]+)/summary$', handleApiWorkflowSummary);
router.addRoute('GET', '^/api/workflow/([a-f0-9-]+)/scratchpads$', handleApiWorkflowScratchpads);
router.addRoute('GET', '^/sse/workflow/([a-f0-9-]+)$', handleSSEWorkflow);
router.addRoute('GET', '^/api/scratchpad/([a-f0-9-]+)/summary$', handleApiScratchpadSummary);
router.addRoute('GET', '^/api/scratchpad/([a-f0-9-]+)/html$', handleApiScratchpadHtml);
router.addRoute('GET', '^/sse/scratchpad/([a-f0-9-]+)$', handleSSEScratchpad);
router.addRoute('PUT', '^/api/workflow/([a-f0-9-]+)/active$', handleUpdateWorkflowActive);
router.addRoute('PUT', '^/api/workflow/([a-f0-9-]+)/scope$', handleUpdateWorkflowScope);
router.addRoute('GET', '^/health$', handleHealth);

/**
 * HTTP 伺服器
 */
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  if (isDev) {
    console.log(`${method} ${pathname}`);
  }

  // 處理靜態檔案
  if (pathname.startsWith('/static/')) {
    return handleStaticFile(req, res, pathname);
  }

  // 找到匹配的路由
  const route = router.findRoute(method, pathname);

  if (route) {
    try {
      await route.handler(req, res, route.params);
    } catch (error) {
      console.error('路由處理錯誤:', error);
      handleError(res, '內部伺服器錯誤', error.message);
    }
  } else {
    handleNotFound(res, '找不到請求的頁面');
  }
});

/**
 * 啟動伺服器
 */
server.listen(port, () => {
  console.log(`🌐 Server running at http://localhost:${port}`);
  console.log(`📊 Database: ${VALIDATED_DB_PATH}`);
  console.log('');
  console.log('🔗 可用路由:');
  console.log(`   http://localhost:${port}/                    - 首頁 (workflows 列表)`);
  console.log(`   http://localhost:${port}/workflow/<id>       - Workflow 詳細頁面`);
  console.log(`   http://localhost:${port}/api/workflows       - Workflows API`);
  console.log(`   http://localhost:${port}/api/project-scopes  - Project Scopes API`);
  console.log(`   http://localhost:${port}/api/workflow/<id>/summary     - Workflow 摘要`);
  console.log(`   http://localhost:${port}/api/workflow/<id>/scratchpads - Scratchpads 片段`);
  console.log(`   http://localhost:${port}/sse/workflow/<id>             - Workflow SSE 推播`);
  console.log(`   http://localhost:${port}/api/scratchpad/<id>/summary   - Scratchpad 摘要`);
  console.log(`   http://localhost:${port}/api/scratchpad/<id>/html      - Scratchpad HTML 片段`);
  console.log(`   http://localhost:${port}/sse/scratchpad/<id>           - Scratchpad SSE 推播`);
  console.log(`   http://localhost:${port}/health              - 健康檢查`);
  console.log(`   http://localhost:${port}/static/*            - 靜態資源`);
  console.log('');
  console.log('💡 使用 Ctrl+C 停止伺服器');
});

// 優雅關閉
process.on('SIGINT', () => {
  console.log('\n🛑 正在關閉伺服器...');
  server.close(() => {
    db.close();
    console.log('✅ 伺服器已關閉');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('🛑 收到 SIGTERM，正在關閉...');
  server.close(() => {
    db.close();
    process.exit(0);
  });
});
