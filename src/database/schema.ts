/**
 * Database schema initialization and migrations
 */
import type Database from 'better-sqlite3';

export const SCHEMA_VERSION = 1;

export const initializeSchema = (db: Database.Database): void => {
  // Enable foreign key support
  db.pragma('foreign_keys = ON');
  
  // Create workflows table
  db.exec(`
    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      scratchpad_count INTEGER NOT NULL DEFAULT 0
    )
  `);

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

      db.exec(`
        CREATE TRIGGER IF NOT EXISTS scratchpads_fts_update 
        AFTER UPDATE ON scratchpads 
        BEGIN
          DELETE FROM scratchpads_fts WHERE rowid = OLD.rowid;
          INSERT INTO scratchpads_fts(rowid, id, workflow_id, title, content) 
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