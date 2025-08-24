/**
 * Main database class for Scratchpad MCP Server
 */
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import {
  initializeSchema,
  checkSchemaVersion,
  hasFTS5Support,
  validateFTS5Index,
  rebuildFTS5Index,
} from './schema.js';
import type {
  Workflow,
  Scratchpad,
  SearchResult,
  DatabaseConfig,
  CreateWorkflowParams,
  CreateScratchpadParams,
  AppendScratchpadParams,
  ListScratchpadsParams,
  SearchScratchpadsParams,
} from './types.js';

export class ScratchpadDatabase {
  private db: Database.Database;
  private hasFTS5: boolean = false;
  private readonly MAX_SCRATCHPAD_SIZE = 1024 * 1024; // 1MB
  private readonly MAX_SCRATCHPADS_PER_WORKFLOW = 50;

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
    this.db.pragma('wal_autocheckpoint = 1000');  // 每 1000 頁自動 checkpoint
    this.db.pragma('wal_checkpoint(PASSIVE)');    // 啟動時執行被動 checkpoint

    // Check for FTS5 support
    this.hasFTS5 = hasFTS5Support(this.db);

    // Initialize schema if needed
    if (!checkSchemaVersion(this.db)) {
      initializeSchema(this.db);
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
      INSERT INTO workflows (id, name, description, created_at, updated_at, scratchpad_count)
      VALUES (?, ?, ?, unixepoch(), unixepoch(), 0)
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
      this.searchScratchpadsFTS = this.db.prepare(`
        SELECT 
          s.*,
          w.name as workflow_name,
          w.description as workflow_description,
          fts.rank
        FROM scratchpads_fts fts
        JOIN scratchpads s ON s.rowid = fts.rowid
        JOIN workflows w ON s.workflow_id = w.id
        WHERE scratchpads_fts MATCH ?
        ${this.hasFTS5 ? 'AND (? IS NULL OR s.workflow_id = ?)' : ''}
        ORDER BY fts.rank
        LIMIT ?
      `);
    }

    this.searchScratchpadsLike = this.db.prepare(`
      SELECT 
        s.*,
        w.name as workflow_name,
        w.description as workflow_description,
        1.0 as rank
      FROM scratchpads s
      JOIN workflows w ON s.workflow_id = w.id
      WHERE (s.title LIKE ? OR s.content LIKE ?)
      ${this.hasFTS5 ? '' : 'AND (? IS NULL OR s.workflow_id = ?)'}
      ORDER BY s.updated_at DESC
      LIMIT ?
    `);
  }

  /**
   * 轉義 FTS5 搜尋中的特殊字符
   * 處理連字號、雙引號、括號等可能導致語法錯誤的字符
   */
  private sanitizeFTS5Query(query: string): string {
    // 轉義 FTS5 特殊字符：- " ( ) : * 
    const escaped = query.replace(/[-"():*]/g, '\\$&');
    return escaped;
  }

  /**
   * 構建安全的 FTS5 搜尋查詢
   * 使用欄位限定搜尋避免語法錯誤
   */
  private buildFTS5Query(query: string): string {
    const escaped = query.replace(/"/g, '""'); // 轉義雙引號
    // 在 title 和 content 欄位中搜尋，避免將特殊字符解析為欄位分隔符
    return `title:"${escaped}" OR content:"${escaped}"`;
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
      return true;
    } catch (error) {
      console.warn('FTS5 健康檢查失敗，切換到 LIKE 搜尋:', error);
      this.hasFTS5 = false;
      return false;
    }
  }

  // Statement properties
  private insertWorkflow!: Database.Statement<[string, string, string | null]>;
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
  private searchScratchpadsLike!: Database.Statement<[string, string, string | null, string | null, number]>;

  /**
   * Create a new workflow
   */
  createWorkflow(params: CreateWorkflowParams): Workflow {
    const id = randomUUID();
    const now = Math.floor(Date.now() / 1000);

    this.insertWorkflow.run(id, params.name, params.description ?? null);

    return {
      id,
      name: params.name,
      description: params.description ?? null,
      created_at: now,
      updated_at: now,
      scratchpad_count: 0,
    };
  }

  /**
   * Get workflow by ID
   */
  getWorkflowById(id: string): Workflow | null {
    const result = this.getWorkflow.get(id) as Workflow | undefined;
    return result ?? null;
  }

  /**
   * List all workflows
   */
  getWorkflows(): Workflow[] {
    return this.listWorkflows.all() as Workflow[];
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
      this.insertScratchpad.run(
        id,
        params.workflow_id,
        params.title,
        params.content,
        sizeBytes
      );
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
    const result = this.getScratchpad.get(id) as Scratchpad | undefined;
    return result ?? null;
  }

  /**
   * Append content to existing scratchpad
   */
  appendToScratchpad(params: AppendScratchpadParams): Scratchpad {
    const existing = this.getScratchpadById(params.id);
    if (!existing) {
      throw new Error(`Scratchpad not found: ${params.id}`);
    }

    const newContent = existing.content + params.content;
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
   * List scratchpads in a workflow
   */
  listScratchpads(params: ListScratchpadsParams): Scratchpad[] {
    const limit = Math.min(params.limit ?? 50, 100);
    const offset = params.offset ?? 0;

    return this.listScratchpadsByWorkflow.all(
      params.workflow_id,
      limit,
      offset
    ) as Scratchpad[];
  }

  /**
   * Search scratchpads using FTS5 or LIKE fallback
   */
  searchScratchpads(params: SearchScratchpadsParams): SearchResult[] {
    const limit = Math.min(params.limit ?? 20, 50);

    // 檢查 FTS5 健康狀態並嘗試使用 FTS5 搜尋
    if (this.checkFTS5Health() && this.searchScratchpadsFTS) {
      try {
        // 使用安全的 FTS5 查詢語法
        const safeQuery = this.buildFTS5Query(params.query);
        const results = this.searchScratchpadsFTS.all(
          safeQuery,
          params.workflow_id ?? null,
          params.workflow_id ?? null,
          limit
        ) as Array<Scratchpad & { workflow_name: string; workflow_description?: string; rank: number }>;

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
            id: row.workflow_id,
            name: row.workflow_name,
            description: row.workflow_description ?? null,
            created_at: 0, // Not needed for search results
            updated_at: 0,
            scratchpad_count: 0,
          },
          rank: row.rank,
        }));
      } catch (error) {
        console.warn('FTS5 搜尋失敗，降級到 LIKE 搜尋:', error);
        this.hasFTS5 = false; // 禁用 FTS5 避免重複錯誤
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
    ) as Array<Scratchpad & { workflow_name: string; workflow_description?: string; rank: number }>;

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
        id: row.workflow_id,
        name: row.workflow_name,
        description: row.workflow_description ?? null,
        created_at: 0,
        updated_at: 0,
        scratchpad_count: 0,
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
    walMode: boolean;
    walSize?: number;
    ftsIndexHealth: boolean;
    lastCheckpoint?: string;
  } {
    const workflowCount = this.db.prepare('SELECT COUNT(*) as count FROM workflows').get() as { count: number };
    const scratchpadCount = this.db.prepare('SELECT COUNT(*) as count FROM scratchpads').get() as { count: number };
    
    // WAL 模式監控
    const journalMode = this.db.prepare('PRAGMA journal_mode').get() as { journal_mode: string };
    const isWalMode = journalMode.journal_mode.toLowerCase() === 'wal';
    
    let walSize: number | undefined;
    let ftsIndexHealth = true;
    let lastCheckpoint: string | undefined;
    
    if (isWalMode) {
      try {
        // 檢查 WAL 檔案大小（頁數）
        const walInfo = this.db.prepare('PRAGMA wal_checkpoint(PASSIVE)').get() as { busy: number; log: number; checkpointed: number };
        walSize = walInfo.log; // WAL 檔案中的頁數
        lastCheckpoint = new Date().toISOString();
      } catch (error) {
        console.warn('WAL checkpoint 狀態檢查失敗:', error);
      }
    }
    
    // FTS5 索引健康檢查
    if (this.hasFTS5) {
      try {
        const mainCount = this.db.prepare('SELECT COUNT(*) as count FROM scratchpads').get() as { count: number };
        const ftsCount = this.db.prepare('SELECT COUNT(*) as count FROM scratchpads_fts').get() as { count: number };
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
      walMode: isWalMode,
      walSize,
      ftsIndexHealth,
      lastCheckpoint,
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
        checkpointed: number 
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