/**
 * Main database class for Scratchpad MCP Server
 */
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import {
  initializeSchema,
  checkSchemaVersion,
  hasFTS5Support,
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
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = 1000');
    this.db.pragma('temp_store = memory');

    // Check for FTS5 support
    this.hasFTS5 = hasFTS5Support(this.db);

    // Initialize schema if needed
    if (!checkSchemaVersion(this.db)) {
      initializeSchema(this.db);
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

    const transaction = this.db.transaction(() => {
      this.updateScratchpad.run(newContent, newSizeBytes, params.id);
      this.updateWorkflowTimestamp.run(existing.workflow_id);
    });

    transaction();

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

    if (this.hasFTS5 && this.searchScratchpadsFTS) {
      // Use FTS5 for better search
      const results = this.searchScratchpadsFTS.all(
        params.query,
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
    } else {
      // Fallback to LIKE search
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
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }

  /**
   * Get database statistics
   */
  getStats(): {
    totalWorkflows: number;
    totalScratchpads: number;
    hasFTS5: boolean;
  } {
    const workflowCount = this.db.prepare('SELECT COUNT(*) as count FROM workflows').get() as { count: number };
    const scratchpadCount = this.db.prepare('SELECT COUNT(*) as count FROM scratchpads').get() as { count: number };

    return {
      totalWorkflows: workflowCount.count,
      totalScratchpads: scratchpadCount.count,
      hasFTS5: this.hasFTS5,
    };
  }
}