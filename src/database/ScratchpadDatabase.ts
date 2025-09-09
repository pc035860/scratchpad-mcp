/**
 * Main database class for Scratchpad MCP Server
 */
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import {
  initializeSchema,
  checkSchemaVersion,
  hasFTS5Support,
  validateFTS5Index,
  rebuildFTS5Index,
} from './schema.js';
import type {
  Workflow,
  WorkflowDbRow,
  Scratchpad,
  SearchResult,
  DatabaseConfig,
  CreateWorkflowParams,
  CreateScratchpadParams,
  AppendScratchpadParams,
  ListScratchpadsParams,
  SearchScratchpadsParams,
} from './types.js';
import { assertScratchpad, assertWorkflowDbRow } from './types.js';

export class ScratchpadDatabase {
  private db: Database.Database;
  private hasFTS5: boolean = false;
  private hasSimpleTokenizer = false; // Simple 中文分詞擴展可用性
  private hasJiebaTokenizer = false; // Jieba 結巴分詞功能可用性
  private readonly MAX_SCRATCHPAD_SIZE = 1024 * 1024; // 1MB
  private readonly MAX_SCRATCHPADS_PER_WORKFLOW = 50;

  /**
   * 嘗試載入 Simple 中文分詞擴展
   */
  private loadSimpleTokenizer(): void {
    try {
      // 智慧檢測：如果在 dist/ 目錄中運行，調整路徑深度
      const isInDist = __dirname.includes('/dist');
      const relativePath = isInDist ? '../extensions/libsimple' : '../../extensions/libsimple';
      const extensionPath = path.resolve(__dirname, relativePath);

      // 嘗試載入擴展
      this.db.loadExtension(extensionPath);

      // 測試 simple 函數是否可用
      const rawTestResult = this.db.prepare("SELECT simple_query('test') as result").get();

      // 直接檢查結果而不使用 assertVersionResult（它期望 value 欄位但我們有 result 欄位）
      if (
        rawTestResult &&
        typeof rawTestResult === 'object' &&
        'result' in rawTestResult &&
        typeof rawTestResult.result === 'string' &&
        rawTestResult.result.length > 0
      ) {
        this.hasSimpleTokenizer = true;
        console.log('✅ Simple 中文分詞擴展載入成功');
      } else {
        throw new Error('simple_query returned invalid result');
      }
    } catch (error) {
      console.warn(
        '⚠️ Simple 擴展載入失敗，將使用預設 tokenizer:',
        error instanceof Error ? error.message : error
      );
      this.hasSimpleTokenizer = false;
    }
  }

  constructor(config: DatabaseConfig) {
    this.db = new Database(config.filename, {
      readonly: config.readonly ?? false,
      timeout: config.timeout ?? 30000,
    });

    // Configure database performance settings
    // 使用 WAL 模式實現最佳併發效能，與 FTS5 完全相容
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = 1000');
    this.db.pragma('temp_store = memory');

    // WAL 模式特定優化
    this.db.pragma('wal_autocheckpoint = 1000'); // 每 1000 頁自動 checkpoint

    // 啟動時執行更可靠的 checkpoint 策略
    try {
      this.db.pragma('wal_checkpoint(TRUNCATE)'); // 強制清空 WAL，確保啟動時一致性
      console.debug('WAL checkpoint (TRUNCATE) completed successfully');
    } catch (error) {
      console.warn('TRUNCATE checkpoint failed, trying RESTART:', error);
      try {
        this.db.pragma('wal_checkpoint(RESTART)'); // 降級到 RESTART 模式
        console.debug('WAL checkpoint (RESTART) completed as fallback');
      } catch (restartError) {
        console.warn(
          'RESTART checkpoint also failed, continuing with normal operation:',
          restartError
        );
        // 繼續執行，因為這不是致命錯誤
      }
    }

    // 嘗試載入 Simple 中文分詞擴展
    this.loadSimpleTokenizer();

    // Check for FTS5 support
    this.hasFTS5 = hasFTS5Support(this.db);

    // Initialize schema if needed
    if (!checkSchemaVersion(this.db)) {
      const tokenizer = this.hasSimpleTokenizer ? 'simple' : 'porter unicode61';
      initializeSchema(this.db, tokenizer);
    }

    // Validate and rebuild FTS5 index if necessary
    if (this.hasFTS5) {
      const isValidIndex = validateFTS5Index(this.db);
      if (!isValidIndex) {
        console.warn('FTS5 索引驗證失敗，嘗試重建...');
        const rebuildSuccess = rebuildFTS5Index(this.db);
        if (!rebuildSuccess) {
          console.warn('FTS5 索引重建失敗，將使用 LIKE 搜尋作為後備方案');
          this.hasFTS5 = false;
        }
      }
    }

    // Prepare common statements
    this.prepareStatements();
  }

  private prepareStatements(): void {
    // Workflow statements
    this.insertWorkflow = this.db.prepare(`
      INSERT INTO workflows (id, name, description, created_at, updated_at, scratchpad_count, is_active, project_scope)
      VALUES (?, ?, ?, unixepoch(), unixepoch(), 0, 1, ?)
    `);

    this.getWorkflow = this.db.prepare(`
      SELECT * FROM workflows WHERE id = ?
    `);

    this.listWorkflows = this.db.prepare(`
      SELECT * FROM workflows ORDER BY updated_at DESC
    `);

    this.updateWorkflowTimestamp = this.db.prepare(`
      UPDATE workflows SET updated_at = unixepoch() WHERE id = ?
    `);

    this.incrementScratchpadCount = this.db.prepare(`
      UPDATE workflows SET scratchpad_count = scratchpad_count + 1 WHERE id = ?
    `);

    // New workflow statements for is_active support
    this.getLatestActiveWorkflowStmt = this.db.prepare(`
      SELECT * FROM workflows 
      WHERE is_active = 1 
      ORDER BY updated_at DESC 
      LIMIT 1
    `);

    this.updateWorkflowActiveStatusStmt = this.db.prepare(`
      UPDATE workflows SET is_active = ?, updated_at = unixepoch() WHERE id = ?
    `);

    // Scratchpad statements
    this.insertScratchpad = this.db.prepare(`
      INSERT INTO scratchpads (id, workflow_id, title, content, created_at, updated_at, size_bytes)
      VALUES (?, ?, ?, ?, unixepoch(), unixepoch(), ?)
    `);

    this.getScratchpad = this.db.prepare(`
      SELECT * FROM scratchpads WHERE id = ?
    `);

    this.updateScratchpad = this.db.prepare(`
      UPDATE scratchpads 
      SET content = ?, size_bytes = ?, updated_at = unixepoch()
      WHERE id = ?
    `);

    this.listScratchpadsByWorkflow = this.db.prepare(`
      SELECT * FROM scratchpads 
      WHERE workflow_id = ? 
      ORDER BY updated_at DESC 
      LIMIT ? OFFSET ?
    `);

    this.countScratchpadsByWorkflow = this.db.prepare(`
      SELECT COUNT(*) as count FROM scratchpads WHERE workflow_id = ?
    `);

    // Search statements
    if (this.hasFTS5) {
      // 根據是否有 simple tokenizer 使用不同的準備語句
      if (this.hasSimpleTokenizer) {
        this.searchScratchpadsFTS = this.db.prepare(`
          SELECT 
            s.id, s.workflow_id, s.title, s.content, s.created_at, s.updated_at, s.size_bytes,
            w.id as w_id, w.name as w_name, w.description as w_description, 
            w.created_at as w_created_at, w.updated_at as w_updated_at, 
            w.scratchpad_count as w_scratchpad_count, w.is_active as w_is_active, w.project_scope as w_project_scope,
            fts.rank
          FROM scratchpads_fts fts
          JOIN scratchpads s ON s.rowid = fts.rowid
          JOIN workflows w ON s.workflow_id = w.id
          WHERE scratchpads_fts MATCH simple_query(?)
          AND (? IS NULL OR s.workflow_id = ?)
          ORDER BY fts.rank
          LIMIT ?
        `);
      } else {
        this.searchScratchpadsFTS = this.db.prepare(`
          SELECT 
            s.id, s.workflow_id, s.title, s.content, s.created_at, s.updated_at, s.size_bytes,
            w.id as w_id, w.name as w_name, w.description as w_description, 
            w.created_at as w_created_at, w.updated_at as w_updated_at, 
            w.scratchpad_count as w_scratchpad_count, w.is_active as w_is_active, w.project_scope as w_project_scope,
            fts.rank
          FROM scratchpads_fts fts
          JOIN scratchpads s ON s.rowid = fts.rowid
          JOIN workflows w ON s.workflow_id = w.id
          WHERE scratchpads_fts MATCH ?
          AND (? IS NULL OR s.workflow_id = ?)
          ORDER BY fts.rank
          LIMIT ?
        `);
      }
    }

    this.searchScratchpadsLike = this.db.prepare(`
      SELECT 
        s.id, s.workflow_id, s.title, s.content, s.created_at, s.updated_at, s.size_bytes,
        w.id as w_id, w.name as w_name, w.description as w_description, 
        w.created_at as w_created_at, w.updated_at as w_updated_at, 
        w.scratchpad_count as w_scratchpad_count, w.is_active as w_is_active, w.project_scope as w_project_scope,
        1.0 as rank
      FROM scratchpads s
      JOIN workflows w ON s.workflow_id = w.id
      WHERE (s.title LIKE ? OR s.content LIKE ?)
      ${this.hasFTS5 ? '' : 'AND (? IS NULL OR s.workflow_id = ?)'}
      ORDER BY s.updated_at DESC
      LIMIT ?
    `);
  }

  // Note: sanitizeFTS5Query was removed as it's not used - buildFTS5Query handles escaping

  /**
   * 構建安全的 FTS5 搜尋查詢
   * 現在直接返回原始查詢，讓 prepared statement 處理參數化
   */
  private buildFTS5Query(query: string): string {
    // 如果有 simple 擴展，使用 simple_query() 函數進行智能查詢
    if (this.hasSimpleTokenizer) {
      // 直接返回查詢，讓 simple_query(?) 的參數化處理安全問題
      return query;
    }

    // 降級到基本 FTS5 查詢 - 使用安全的參數化格式
    // 轉義雙引號以防止 FTS5 語法錯誤
    const escaped = query.replace(/"/g, '""');
    // 在 title 和 content 欄位中搜尋，避免將特殊字符解析為欄位分隔符
    return `title:"${escaped}" OR content:"${escaped}"`;
  }

  /**
   * 使用 jieba_query() 進行結巴分詞搜尋
   * 提供更智慧的中文語意分析和搜尋體驗
   */
  private searchWithJieba(
    query: string,
    workflowId?: string,
    limit: number = 20
  ): Array<{
    id: string;
    workflow_id: string;
    title: string;
    content: string;
    created_at: number;
    updated_at: number;
    size_bytes: number;
    w_id: string;
    w_name: string;
    w_description: string | null;
    w_created_at: number;
    w_updated_at: number;
    w_scratchpad_count: number;
    w_is_active: number;
    w_project_scope: string | null;
    rank: number;
  }> {
    // 使用參數化查詢防止 SQL 注入
    const sql = `
      SELECT 
        s.id, s.workflow_id, s.title, s.content, s.created_at, s.updated_at, s.size_bytes,
        w.id as w_id, w.name as w_name, w.description as w_description, 
        w.created_at as w_created_at, w.updated_at as w_updated_at, 
        w.scratchpad_count as w_scratchpad_count, w.is_active as w_is_active, w.project_scope as w_project_scope,
        fts.rank
      FROM scratchpads_fts fts
      JOIN scratchpads s ON s.rowid = fts.rowid
      JOIN workflows w ON s.workflow_id = w.id
      WHERE scratchpads_fts MATCH jieba_query(?)
      AND (? IS NULL OR s.workflow_id = ?)
      ORDER BY fts.rank
      LIMIT ?
    `;

    const stmt = this.db.prepare(sql);
    return stmt.all(query, workflowId, workflowId, limit) as Array<{
      id: string;
      workflow_id: string;
      title: string;
      content: string;
      created_at: number;
      updated_at: number;
      size_bytes: number;
      w_id: string;
      w_name: string;
      w_description: string | null;
      w_created_at: number;
      w_updated_at: number;
      w_scratchpad_count: number;
      w_is_active: number;
      w_project_scope: string | null;
      rank: number;
    }>;
  }

  /**
   * 檢查 FTS5 健康狀態
   * 如果 FTS5 出現問題，自動降級到 LIKE 搜尋
   */
  private checkFTS5Health(): boolean {
    if (!this.hasFTS5) return false;

    try {
      // 嘗試簡單的 FTS5 操作
      this.db.prepare('SELECT COUNT(*) FROM scratchpads_fts LIMIT 1').get();

      // 如果使用 simple tokenizer，也要檢查 simple 函數
      if (this.hasSimpleTokenizer) {
        try {
          this.db.prepare("SELECT simple_query('test') as result").get();

          // 重新啟用 jieba 檢查，字典路徑已透過符號連結解決
          try {
            // 測試 jieba_query() 是否正常工作 - 使用更安全的測試方式
            const rawTestResult = this.db.prepare("SELECT jieba_query('test') as result").get();

            // 直接檢查結果而不使用 assertVersionResult
            if (
              rawTestResult &&
              typeof rawTestResult === 'object' &&
              'result' in rawTestResult &&
              typeof rawTestResult.result === 'string' &&
              rawTestResult.result.length > 0
            ) {
              this.hasJiebaTokenizer = true;
              console.log('✅ Jieba 結巴分詞功能完全可用');
            } else {
              throw new Error('jieba_query returned empty result');
            }
          } catch (jiebaError) {
            console.warn(
              '⚠️ Jieba 功能不可用，使用 simple_query:',
              jiebaError instanceof Error ? jiebaError.message : jiebaError
            );
            this.hasJiebaTokenizer = false;
          }
        } catch (simpleError) {
          console.warn('⚠️ Simple 擴展函數測試失敗，降級到基本 FTS5:', simpleError);
          this.hasSimpleTokenizer = false;
          this.hasJiebaTokenizer = false; // Simple 不可用時，jieba 也不可用
        }
      }

      return true;
    } catch (error) {
      console.warn('FTS5 健康檢查失敗，切換到 LIKE 搜尋:', error);
      this.hasFTS5 = false;
      this.hasSimpleTokenizer = false;
      return false;
    }
  }

  // New workflow-related statements
  private getLatestActiveWorkflowStmt!: Database.Statement<[]>;
  private updateWorkflowActiveStatusStmt!: Database.Statement<[number, string]>;

  // Statement properties
  private insertWorkflow!: Database.Statement<[string, string, string | null, string | null]>;
  private getWorkflow!: Database.Statement<[string]>;
  private listWorkflows!: Database.Statement<[]>;
  private updateWorkflowTimestamp!: Database.Statement<[string]>;
  private incrementScratchpadCount!: Database.Statement<[string]>;
  private insertScratchpad!: Database.Statement<[string, string, string, string, number]>;
  private getScratchpad!: Database.Statement<[string]>;
  private updateScratchpad!: Database.Statement<[string, number, string]>;
  private listScratchpadsByWorkflow!: Database.Statement<[string, number, number]>;
  private countScratchpadsByWorkflow!: Database.Statement<[string]>;
  private searchScratchpadsFTS?: Database.Statement<[string, string | null, string | null, number]>;
  private searchScratchpadsLike!: Database.Statement<
    [string, string, string | null, string | null, number]
  >;

  /**
   * Create a new workflow
   */
  createWorkflow(params: CreateWorkflowParams): Workflow {
    const id = randomUUID();
    const now = Math.floor(Date.now() / 1000);

    this.insertWorkflow.run(
      id,
      params.name,
      params.description ?? null,
      params.project_scope ?? null
    );

    return {
      id,
      name: params.name,
      description: params.description ?? null,
      created_at: now,
      updated_at: now,
      scratchpad_count: 0,
      is_active: true,
      project_scope: params.project_scope ?? null,
    };
  }

  /**
   * Get workflow by ID
   */
  getWorkflowById(id: string): Workflow | null {
    const rawResult = this.getWorkflow.get(id);
    const result = assertWorkflowDbRow(rawResult, 'getWorkflowById');
    if (!result) {
      return null;
    }
    return {
      ...result,
      is_active: Boolean(result.is_active),
    };
  }

  /**
   * List all workflows
   */
  getWorkflows(projectScope?: string): Workflow[] {
    let results: WorkflowDbRow[];

    if (projectScope) {
      // Use project-specific query
      const scopedStmt = this.db.prepare(`
        SELECT * FROM workflows 
        WHERE project_scope = ?
        ORDER BY updated_at DESC
      `);
      results = scopedStmt.all(projectScope) as WorkflowDbRow[];
    } else {
      // Use the existing global query
      results = this.listWorkflows.all() as WorkflowDbRow[];
    }

    return results.map((result) => ({
      ...result,
      is_active: Boolean(result.is_active),
    }));
  }

  /**
   * Get the latest active workflow
   */
  getLatestActiveWorkflow(projectScope?: string): Workflow | null {
    let result: WorkflowDbRow | null;

    if (projectScope) {
      // Use project-specific query
      const scopedStmt = this.db.prepare(`
        SELECT * FROM workflows 
        WHERE is_active = 1 AND project_scope = ?
        ORDER BY updated_at DESC 
        LIMIT 1
      `);
      const rawResult = scopedStmt.get(projectScope);
      result = assertWorkflowDbRow(rawResult, 'getLatestActiveWorkflow with projectScope');
    } else {
      // Use the existing global query
      const rawResult = this.getLatestActiveWorkflowStmt.get();
      result = assertWorkflowDbRow(rawResult, 'getLatestActiveWorkflow global');
    }

    if (!result) {
      return null;
    }
    return {
      ...result,
      is_active: Boolean(result.is_active),
    };
  }

  /**
   * Update workflow active status
   */
  setWorkflowActiveStatus(id: string, isActive: boolean): Workflow | null {
    const existing = this.getWorkflowById(id);
    if (!existing) {
      throw new Error(`Workflow not found: ${id}`);
    }

    this.updateWorkflowActiveStatusStmt.run(isActive ? 1 : 0, id);

    return this.getWorkflowById(id);
  }

  /**
   * Create a new scratchpad
   */
  createScratchpad(params: CreateScratchpadParams): Scratchpad {
    // Validate workflow exists
    const workflow = this.getWorkflowById(params.workflow_id);
    if (!workflow) {
      throw new Error(`Workflow not found: ${params.workflow_id}`);
    }

    // Check if workflow is active
    if (!workflow.is_active) {
      throw new Error(`Cannot create scratchpad: workflow is not active: ${params.workflow_id}`);
    }

    // Check size limit
    const sizeBytes = Buffer.byteLength(params.content, 'utf8');
    if (sizeBytes > this.MAX_SCRATCHPAD_SIZE) {
      throw new Error(
        `Scratchpad content too large: ${sizeBytes} bytes (max: ${this.MAX_SCRATCHPAD_SIZE} bytes)`
      );
    }

    // Check scratchpad count limit
    const count = this.countScratchpadsByWorkflow.get(params.workflow_id) as { count: number };
    if (count.count >= this.MAX_SCRATCHPADS_PER_WORKFLOW) {
      throw new Error(
        `Too many scratchpads in workflow: ${count.count} (max: ${this.MAX_SCRATCHPADS_PER_WORKFLOW})`
      );
    }

    const id = randomUUID();
    const now = Math.floor(Date.now() / 1000);

    // Use transaction for consistency
    const transaction = this.db.transaction(() => {
      this.insertScratchpad.run(id, params.workflow_id, params.title, params.content, sizeBytes);
      this.incrementScratchpadCount.run(params.workflow_id);
      this.updateWorkflowTimestamp.run(params.workflow_id);
    });

    transaction();

    return {
      id,
      workflow_id: params.workflow_id,
      title: params.title,
      content: params.content,
      created_at: now,
      updated_at: now,
      size_bytes: sizeBytes,
    };
  }

  /**
   * Get scratchpad by ID
   */
  getScratchpadById(id: string): Scratchpad | null {
    const rawResult = this.getScratchpad.get(id);
    return assertScratchpad(rawResult, 'getScratchpadById');
  }

  /**
   * Append content to existing scratchpad
   */
  appendToScratchpad(params: AppendScratchpadParams): Scratchpad {
    const existing = this.getScratchpadById(params.id);
    if (!existing) {
      throw new Error(`Scratchpad not found: ${params.id}`);
    }

    // Check if the workflow is active
    const workflow = this.getWorkflowById(existing.workflow_id);
    if (!workflow || !workflow.is_active) {
      throw new Error(
        `Cannot append to scratchpad: workflow is not active: ${existing.workflow_id}`
      );
    }

    // Block-based 分隔模板：兩個空行 + 分隔線 + block 標記
    const appendTemplate = '\n\n---\n<!--- block start --->\n';
    const newContent =
      existing.content.trim() === ''
        ? params.content // 首次 append 不需要分隔符
        : existing.content + appendTemplate + params.content;
    const newSizeBytes = Buffer.byteLength(newContent, 'utf8');

    if (newSizeBytes > this.MAX_SCRATCHPAD_SIZE) {
      throw new Error(
        `Appending would exceed size limit: ${newSizeBytes} bytes (max: ${this.MAX_SCRATCHPAD_SIZE} bytes)`
      );
    }

    // 使用簡化的事務處理，依賴 SQLite 原生 FTS5 觸發器
    // 在 WAL 模式下，觸發器事務問題已在新版本 SQLite 中修復
    const transaction = this.db.transaction(() => {
      this.updateScratchpad.run(newContent, newSizeBytes, params.id);
      this.updateWorkflowTimestamp.run(existing.workflow_id);
    });

    try {
      transaction();
    } catch (error) {
      // 如果發生 FTS5 相關錯誤，標記 FTS5 為不健康並降級到 LIKE 搜尋
      if (error instanceof Error && error.message.includes('fts')) {
        console.warn('檢測到 FTS5 相關錯誤，將降級到 LIKE 搜尋:', error.message);
        this.hasFTS5 = false;

        // 重試事務（觸發器會自動跳過 FTS5 操作）
        transaction();
      } else {
        // 重新拋出非 FTS5 相關的錯誤
        throw error;
      }
    }

    const updated = this.getScratchpadById(params.id);
    if (!updated) {
      throw new Error('Failed to update scratchpad');
    }

    return updated;
  }

  /**
   * Update scratchpad content directly (for operations like chop)
   */
  updateScratchpadContent(id: string, newContent: string): Scratchpad {
    const existing = this.getScratchpadById(id);
    if (!existing) {
      throw new Error(`Scratchpad not found: ${id}`);
    }

    // Check if the workflow is active
    const workflow = this.getWorkflowById(existing.workflow_id);
    if (!workflow || !workflow.is_active) {
      throw new Error(`Cannot update scratchpad: workflow is not active: ${existing.workflow_id}`);
    }

    const newSizeBytes = Buffer.byteLength(newContent, 'utf8');

    // Use transaction for consistency
    const transaction = this.db.transaction(() => {
      this.updateScratchpad.run(newContent, newSizeBytes, id);
      this.updateWorkflowTimestamp.run(existing.workflow_id);
    });

    try {
      transaction();
    } catch (error) {
      // Handle FTS5 related errors similar to appendToScratchpad
      if (error instanceof Error && error.message.includes('fts')) {
        console.warn('檢測到 FTS5 相關錯誤，將降級到 LIKE 搜尋:', error.message);
        this.hasFTS5 = false;
        transaction(); // Retry transaction
      } else {
        throw error;
      }
    }

    const updated = this.getScratchpadById(id);
    if (!updated) {
      throw new Error('Failed to update scratchpad');
    }

    return updated;
  }

  /**
   * List scratchpads in a workflow
   */
  listScratchpads(params: ListScratchpadsParams): Scratchpad[] {
    const limit = Math.min(params.limit ?? 50, 100);
    const offset = params.offset ?? 0;

    return this.listScratchpadsByWorkflow.all(params.workflow_id, limit, offset) as Scratchpad[];
  }

  /**
   * Search scratchpads using FTS5 or LIKE fallback
   */
  searchScratchpads(params: SearchScratchpadsParams): SearchResult[] {
    const limit = Math.min(params.limit ?? 20, 50);

    // 檢查 FTS5 健康狀態並嘗試使用 FTS5 搜尋
    if (this.checkFTS5Health()) {
      try {
        let results: Array<{
          id: string;
          workflow_id: string;
          title: string;
          content: string;
          created_at: number;
          updated_at: number;
          size_bytes: number;
          w_id: string;
          w_name: string;
          w_description: string | null;
          w_created_at: number;
          w_updated_at: number;
          w_scratchpad_count: number;
          w_is_active: number;
          w_project_scope: string | null;
          rank: number;
        }>;

        // 智慧模式選擇：自動偵測中文內容並選擇最佳搜尋方式
        const hasChinese = /[\u4e00-\u9fa5]/.test(params.query);
        const shouldUseJieba = params.useJieba || (hasChinese && this.hasJiebaTokenizer);

        if (shouldUseJieba && this.hasJiebaTokenizer) {
          // 優先使用 jieba_query() 結巴分詞搜尋 - 提供最佳中文搜尋體驗
          try {
            results = this.searchWithJieba(params.query, params.workflow_id, limit);
          } catch (jiebaError) {
            console.warn('⚠️ Jieba 搜尋失敗，降級到 simple_query:', jiebaError);
            // 降級到 simple_query，使用參數化查詢
            const sql = `
              SELECT 
                s.id, s.workflow_id, s.title, s.content, s.created_at, s.updated_at, s.size_bytes,
                w.id as w_id, w.name as w_name, w.description as w_description, 
                w.created_at as w_created_at, w.updated_at as w_updated_at, 
                w.scratchpad_count as w_scratchpad_count, w.is_active as w_is_active, w.project_scope as w_project_scope,
                fts.rank
              FROM scratchpads_fts fts
              JOIN scratchpads s ON s.rowid = fts.rowid
              JOIN workflows w ON s.workflow_id = w.id
              WHERE scratchpads_fts MATCH simple_query(?)
              AND (? IS NULL OR s.workflow_id = ?)
              ORDER BY fts.rank
              LIMIT ?
            `;

            const stmt = this.db.prepare(sql);
            results = stmt.all(
              params.query,
              params.workflow_id,
              params.workflow_id,
              limit
            ) as Array<{
              id: string;
              workflow_id: string;
              title: string;
              content: string;
              created_at: number;
              updated_at: number;
              size_bytes: number;
              w_id: string;
              w_name: string;
              w_description: string | null;
              w_created_at: number;
              w_updated_at: number;
              w_scratchpad_count: number;
              w_is_active: number;
              w_project_scope: string | null;
              rank: number;
            }>;
          }
        } else if (this.hasSimpleTokenizer) {
          // 使用 simple_query() 函數，使用參數化查詢
          const sql = `
            SELECT 
              s.id, s.workflow_id, s.title, s.content, s.created_at, s.updated_at, s.size_bytes,
              w.id as w_id, w.name as w_name, w.description as w_description, 
              w.created_at as w_created_at, w.updated_at as w_updated_at, 
              w.scratchpad_count as w_scratchpad_count, w.is_active as w_is_active, w.project_scope as w_project_scope,
              fts.rank
            FROM scratchpads_fts fts
            JOIN scratchpads s ON s.rowid = fts.rowid
            JOIN workflows w ON s.workflow_id = w.id
            WHERE scratchpads_fts MATCH simple_query(?)
            AND (? IS NULL OR s.workflow_id = ?)
            ORDER BY fts.rank
            LIMIT ?
          `;

          const stmt = this.db.prepare(sql);
          results = stmt.all(params.query, params.workflow_id, params.workflow_id, limit) as Array<{
            id: string;
            workflow_id: string;
            title: string;
            content: string;
            created_at: number;
            updated_at: number;
            size_bytes: number;
            w_id: string;
            w_name: string;
            w_description: string | null;
            w_created_at: number;
            w_updated_at: number;
            w_scratchpad_count: number;
            w_is_active: number;
            w_project_scope: string | null;
            rank: number;
          }>;
        } else if (this.searchScratchpadsFTS) {
          // 使用標準 FTS5 查詢 - 現在安全地直接傳遞參數
          if (this.hasSimpleTokenizer) {
            // simple_query(?) 會安全地處理用戶輸入
            results = this.searchScratchpadsFTS.all(
              params.query, // 直接傳遞原始查詢
              params.workflow_id ?? null,
              params.workflow_id ?? null,
              limit
            ) as Array<{
              id: string;
              workflow_id: string;
              title: string;
              content: string;
              created_at: number;
              updated_at: number;
              size_bytes: number;
              w_id: string;
              w_name: string;
              w_description: string | null;
              w_created_at: number;
              w_updated_at: number;
              w_scratchpad_count: number;
              w_is_active: number;
              w_project_scope: string | null;
              rank: number;
            }>;
          } else {
            // 基本 FTS5 查詢 - 需要使用構建的安全查詢
            const safeQuery = this.buildFTS5Query(params.query);
            results = this.searchScratchpadsFTS.all(
              safeQuery,
              params.workflow_id ?? null,
              params.workflow_id ?? null,
              limit
            ) as Array<{
              id: string;
              workflow_id: string;
              title: string;
              content: string;
              created_at: number;
              updated_at: number;
              size_bytes: number;
              w_id: string;
              w_name: string;
              w_description: string | null;
              w_created_at: number;
              w_updated_at: number;
              w_scratchpad_count: number;
              w_is_active: number;
              w_project_scope: string | null;
              rank: number;
            }>;
          }
        } else {
          throw new Error('No FTS search method available');
        }

        return results.map((row) => ({
          scratchpad: {
            id: row.id,
            workflow_id: row.workflow_id,
            title: row.title,
            content: row.content,
            created_at: row.created_at,
            updated_at: row.updated_at,
            size_bytes: row.size_bytes,
          },
          workflow: {
            id: row.w_id,
            name: row.w_name,
            description: row.w_description,
            created_at: row.w_created_at,
            updated_at: row.w_updated_at,
            scratchpad_count: row.w_scratchpad_count,
            is_active: Boolean(row.w_is_active),
            project_scope: row.w_project_scope,
          },
          rank: row.rank,
        }));
      } catch (error) {
        console.warn('FTS5 搜尋失敗，降級到 LIKE 搜尋:', error);
        this.hasFTS5 = false; // 禁用 FTS5 避免重複錯誤
        this.hasSimpleTokenizer = false; // 也禁用 simple 擴展
      }
    }

    // Fallback to LIKE search (或 FTS5 失敗時的降級搜尋)
    const searchPattern = `%${params.query}%`;
    const results = this.searchScratchpadsLike.all(
      searchPattern,
      searchPattern,
      params.workflow_id ?? null,
      params.workflow_id ?? null,
      limit
    ) as Array<{
      id: string;
      workflow_id: string;
      title: string;
      content: string;
      created_at: number;
      updated_at: number;
      size_bytes: number;
      w_id: string;
      w_name: string;
      w_description: string | null;
      w_created_at: number;
      w_updated_at: number;
      w_scratchpad_count: number;
      w_is_active: number;
      w_project_scope: string | null;
      rank: number;
    }>;

    return results.map((row) => ({
      scratchpad: {
        id: row.id,
        workflow_id: row.workflow_id,
        title: row.title,
        content: row.content,
        created_at: row.created_at,
        updated_at: row.updated_at,
        size_bytes: row.size_bytes,
      },
      workflow: {
        id: row.w_id,
        name: row.w_name,
        description: row.w_description,
        created_at: row.w_created_at,
        updated_at: row.w_updated_at,
        scratchpad_count: row.w_scratchpad_count,
        is_active: Boolean(row.w_is_active),
        project_scope: row.w_project_scope,
      },
      rank: row.rank,
    }));
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }

  /**
   * Get database statistics including WAL mode health monitoring
   */
  getStats(): {
    totalWorkflows: number;
    totalScratchpads: number;
    hasFTS5: boolean;
    hasSimpleTokenizer: boolean;
    hasJiebaTokenizer: boolean;
    walMode: boolean;
    walSize?: number;
    ftsIndexHealth: boolean;
    lastCheckpoint?: string;
  } {
    const workflowCount = this.db.prepare('SELECT COUNT(*) as count FROM workflows').get() as {
      count: number;
    };
    const scratchpadCount = this.db.prepare('SELECT COUNT(*) as count FROM scratchpads').get() as {
      count: number;
    };

    // WAL 模式監控
    const journalMode = this.db.prepare('PRAGMA journal_mode').get() as { journal_mode: string };
    const isWalMode = journalMode.journal_mode.toLowerCase() === 'wal';

    let walSize: number | undefined;
    let ftsIndexHealth = true;
    let lastCheckpoint: string | undefined;

    if (isWalMode) {
      try {
        // 檢查 WAL 檔案大小（頁數）
        const walInfo = this.db.prepare('PRAGMA wal_checkpoint(PASSIVE)').get() as {
          busy: number;
          log: number;
          checkpointed: number;
        };
        walSize = walInfo.log; // WAL 檔案中的頁數
        lastCheckpoint = new Date().toISOString();
      } catch (error) {
        console.warn('WAL checkpoint 狀態檢查失敗:', error);
      }
    }

    // FTS5 索引健康檢查
    if (this.hasFTS5) {
      try {
        const mainCount = this.db.prepare('SELECT COUNT(*) as count FROM scratchpads').get() as {
          count: number;
        };
        const ftsCount = this.db.prepare('SELECT COUNT(*) as count FROM scratchpads_fts').get() as {
          count: number;
        };
        ftsIndexHealth = mainCount.count === ftsCount.count;
      } catch (error) {
        console.warn('FTS5 索引健康檢查失敗:', error);
        ftsIndexHealth = false;
      }
    }

    return {
      totalWorkflows: workflowCount.count,
      totalScratchpads: scratchpadCount.count,
      hasFTS5: this.hasFTS5,
      hasSimpleTokenizer: this.hasSimpleTokenizer,
      hasJiebaTokenizer: this.hasJiebaTokenizer,
      walMode: isWalMode,
      ...(walSize !== undefined && { walSize }),
      ftsIndexHealth,
      ...(lastCheckpoint !== undefined && { lastCheckpoint }),
    };
  }

  /**
   * Perform manual WAL checkpoint to optimize database performance
   */
  performCheckpoint(): { success: boolean; walPages: number; checkpointedPages: number } {
    try {
      const result = this.db.prepare('PRAGMA wal_checkpoint(RESTART)').get() as {
        busy: number;
        log: number;
        checkpointed: number;
      };

      return {
        success: result.busy === 0,
        walPages: result.log,
        checkpointedPages: result.checkpointed,
      };
    } catch (error) {
      console.warn('手動 checkpoint 執行失敗:', error);
      return {
        success: false,
        walPages: 0,
        checkpointedPages: 0,
      };
    }
  }
}
