/**
 * Database schema initialization and migrations
 */
import type Database from 'better-sqlite3';

export const SCHEMA_VERSION = 3;

export const initializeSchema = (db: Database.Database): void => {
  // Enable foreign key support
  db.pragma('foreign_keys = ON');
  
  // Create workflows table with all fields including project_scope
  db.exec(`
    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      scratchpad_count INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT 1,
      project_scope TEXT DEFAULT NULL
    )
  `);

  // Handle schema migration from v1 to v2
  migrateSchema(db);

  // Create scratchpads table
  db.exec(`
    CREATE TABLE IF NOT EXISTS scratchpads (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      size_bytes INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_scratchpads_workflow_id 
    ON scratchpads(workflow_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_scratchpads_updated_at 
    ON scratchpads(updated_at DESC)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_workflows_updated_at 
    ON workflows(updated_at DESC)
  `);

  // Add index for project_scope filtering
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_workflows_project_scope 
    ON workflows(project_scope)
  `);

  // Initialize FTS5 virtual table for full-text search
  // Only if explicitly enabled (avoid issues in testing)
  if (process.env['NODE_ENV'] !== 'test') {
    try {
      db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS scratchpads_fts 
        USING fts5(
          id UNINDEXED,
          workflow_id UNINDEXED,
          title,
          content,
          content='scratchpads',
          content_rowid='rowid',
          tokenize='porter unicode61'
        )
      `);

      // Create triggers to keep FTS5 in sync
      db.exec(`
        CREATE TRIGGER IF NOT EXISTS scratchpads_fts_insert 
        AFTER INSERT ON scratchpads 
        BEGIN
          INSERT INTO scratchpads_fts(rowid, id, workflow_id, title, content) 
          VALUES (NEW.rowid, NEW.id, NEW.workflow_id, NEW.title, NEW.content);
        END
      `);

      db.exec(`
        CREATE TRIGGER IF NOT EXISTS scratchpads_fts_delete 
        AFTER DELETE ON scratchpads 
        BEGIN
          DELETE FROM scratchpads_fts WHERE rowid = OLD.rowid;
        END
      `);

      // 使用 INSERT OR REPLACE 觸發器確保 FTS5 索引同步，與 WAL 模式完全相容
      db.exec(`
        CREATE TRIGGER IF NOT EXISTS scratchpads_fts_update 
        AFTER UPDATE ON scratchpads 
        BEGIN
          INSERT OR REPLACE INTO scratchpads_fts(rowid, id, workflow_id, title, content) 
          VALUES (NEW.rowid, NEW.id, NEW.workflow_id, NEW.title, NEW.content);
        END
      `);

    } catch (error) {
      // FTS5 not available, fall back to basic search
      console.warn('FTS5 not available, falling back to LIKE search:', error);
    }
  }

  // Create schema version table
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_info (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // Insert or update schema version
  const insertVersion = db.prepare(`
    INSERT OR REPLACE INTO schema_info (key, value) VALUES (?, ?)
  `);
  insertVersion.run('version', SCHEMA_VERSION.toString());
};

/**
 * Handle schema migrations
 */
export const migrateSchema = (db: Database.Database): void => {
  let currentVersion = 1;
  
  try {
    const getVersion = db.prepare(`
      SELECT value FROM schema_info WHERE key = ?
    `);
    const result = getVersion.get('version') as { value: string } | undefined;
    
    if (result) {
      currentVersion = parseInt(result.value, 10);
    }
  } catch {
    // schema_info table doesn't exist, this is a new database
    return;
  }

  // Migration from v1 to v2: Add is_active column
  if (currentVersion < 2) {
    console.log('Migrating database schema from v1 to v2...');
    try {
      // Check if column already exists
      const tableInfo = db.prepare(`PRAGMA table_info(workflows)`).all() as Array<{ name: string }>;
      const hasIsActive = tableInfo.some(column => column.name === 'is_active');
      
      if (!hasIsActive) {
        db.exec(`ALTER TABLE workflows ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT 1`);
        console.log('✅ Added is_active column to workflows table');
      }
    } catch (error) {
      console.error('Failed to migrate schema to v2:', error);
      throw error;
    }
  }

  // Migration from v2 to v3: Add project_scope column
  if (currentVersion < 3) {
    console.log('Migrating database schema from v2 to v3...');
    try {
      // Check if column already exists
      const tableInfo = db.prepare(`PRAGMA table_info(workflows)`).all() as Array<{ name: string }>;
      const hasProjectScope = tableInfo.some(column => column.name === 'project_scope');
      
      if (!hasProjectScope) {
        db.exec(`ALTER TABLE workflows ADD COLUMN project_scope TEXT DEFAULT NULL`);
        console.log('✅ Added project_scope column to workflows table');
        
        // Create index for project_scope
        db.exec(`CREATE INDEX IF NOT EXISTS idx_workflows_project_scope ON workflows(project_scope)`);
        console.log('✅ Created index for project_scope column');
      }
    } catch (error) {
      console.error('Failed to migrate schema to v3:', error);
      throw error;
    }
  }
};

export const checkSchemaVersion = (db: Database.Database): boolean => {
  try {
    const getVersion = db.prepare(`
      SELECT value FROM schema_info WHERE key = ?
    `);
    const result = getVersion.get('version') as { value: string } | undefined;
    
    if (!result) {
      return false;
    }
    
    const version = parseInt(result.value, 10);
    return version === SCHEMA_VERSION;
  } catch {
    return false;
  }
};

export const hasFTS5Support = (db: Database.Database): boolean => {
  // Disable FTS5 in test environment to avoid issues
  if (process.env['NODE_ENV'] === 'test') {
    return false;
  }
  
  try {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS fts_test 
      USING fts5(content)
    `);
    db.exec('DROP TABLE fts_test');
    return true;
  } catch {
    return false;
  }
};

/**
 * 重建 FTS5 索引
 * 在資料庫修復或索引損壞時使用
 */
export const rebuildFTS5Index = (db: Database.Database): boolean => {
  if (!hasFTS5Support(db)) {
    console.warn('FTS5 不支援，跳過索引重建');
    return false;
  }

  try {
    // 檢查 FTS5 表是否存在
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='scratchpads_fts'
    `).get();

    if (tableExists) {
      console.log('重建 FTS5 索引...');
      db.exec(`INSERT INTO scratchpads_fts(scratchpads_fts) VALUES('rebuild')`);
      console.log('✅ FTS5 索引重建完成');
      return true;
    } else {
      console.warn('FTS5 表不存在，無法重建索引');
      return false;
    }
  } catch (error) {
    console.error('FTS5 索引重建失敗:', error);
    return false;
  }
};

/**
 * 驗證 FTS5 索引健康狀態
 */
export const validateFTS5Index = (db: Database.Database): boolean => {
  if (!hasFTS5Support(db)) {
    return false;
  }

  try {
    // 檢查主表和 FTS5 表的記錄數量是否一致
    const scratchpadCount = db.prepare('SELECT COUNT(*) as count FROM scratchpads').get() as { count: number };
    const ftsCount = db.prepare('SELECT COUNT(*) as count FROM scratchpads_fts').get() as { count: number };

    const isHealthy = scratchpadCount.count === ftsCount.count;
    
    if (!isHealthy) {
      console.warn(`FTS5 索引不一致: 主表 ${scratchpadCount.count} 記錄, FTS5 表 ${ftsCount.count} 記錄`);
      // 自動重建索引
      return rebuildFTS5Index(db);
    }

    return true;
  } catch (error) {
    console.error('FTS5 索引驗證失敗:', error);
    return false;
  }
};