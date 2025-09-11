#!/usr/bin/env node

/**
 * 獨立的資料庫遷移腳本 - 添加 workflows_fts 支援
 * 
 * 使用方式：
 *   node scripts/migrate-workflows-fts.js [database_path]
 * 
 * 如果不提供 database_path，將使用預設的 ./scratchpad.db
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// 預設資料庫路徑
const DEFAULT_DB_PATH = './scratchpad.db';
const SCHEMA_VERSION_TARGET = 4;

/**
 * 檢查 FTS5 支援
 */
function hasFTS5Support(db) {
  try {
    db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS fts_test USING fts5(content)`);
    db.exec('DROP TABLE fts_test');
    return true;
  } catch {
    return false;
  }
}

/**
 * 獲取當前 schema 版本
 */
function getCurrentSchemaVersion(db) {
  try {
    const getVersion = db.prepare(`SELECT value FROM schema_info WHERE key = ?`);
    const result = getVersion.get('version');
    return result ? parseInt(result.value, 10) : 1;
  } catch {
    // schema_info 表不存在，這是一個新資料庫
    return 1;
  }
}

/**
 * 更新 schema 版本
 */
function updateSchemaVersion(db, version) {
  const insertVersion = db.prepare(`INSERT OR REPLACE INTO schema_info (key, value) VALUES (?, ?)`);
  insertVersion.run('version', version.toString());
}

/**
 * 創建資料庫備份
 */
function createBackup(dbPath) {
  const backupPath = `${dbPath}.backup.${Date.now()}`;
  console.log(`🔄 正在創建資料庫備份: ${backupPath}`);
  
  try {
    fs.copyFileSync(dbPath, backupPath);
    console.log(`✅ 備份創建成功: ${backupPath}`);
    return backupPath;
  } catch (error) {
    console.error('❌ 創建備份失敗:', error.message);
    throw error;
  }
}

/**
 * 驗證遷移結果
 */
function validateMigration(db) {
  console.log('🔍 驗證遷移結果...');
  
  try {
    // 檢查 schema 版本
    const currentVersion = getCurrentSchemaVersion(db);
    if (currentVersion !== SCHEMA_VERSION_TARGET) {
      throw new Error(`Schema 版本不匹配: 期望 ${SCHEMA_VERSION_TARGET}, 實際 ${currentVersion}`);
    }
    
    // 檢查 workflows 表
    const workflowsCount = db.prepare('SELECT COUNT(*) as count FROM workflows').get().count;
    console.log(`ℹ️  workflows 表記錄數: ${workflowsCount}`);
    
    // 檢查 workflows_fts 表 (如果存在)
    try {
      const workflowsFtsExists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='workflows_fts'`).get();
      
      if (workflowsFtsExists) {
        const workflowsFtsCount = db.prepare('SELECT COUNT(*) as count FROM workflows_fts').get().count;
        console.log(`ℹ️  workflows_fts 表記錄數: ${workflowsFtsCount}`);
        
        if (workflowsCount !== workflowsFtsCount) {
          throw new Error(`資料不一致: workflows (${workflowsCount}) vs workflows_fts (${workflowsFtsCount})`);
        }
        
        // 檢查觸發器
        const triggers = ['workflows_fts_insert', 'workflows_fts_update', 'workflows_fts_delete'];
        for (const triggerName of triggers) {
          const triggerExists = db.prepare(`SELECT name FROM sqlite_master WHERE type='trigger' AND name=?`).get(triggerName);
          if (!triggerExists) {
            throw new Error(`觸發器 ${triggerName} 不存在`);
          }
        }
        console.log('✅ workflows_fts 表和觸發器驗證通過');
      } else {
        console.log('ℹ️  workflows_fts 表不存在 (FTS5 不支援或測試環境)');
      }
    } catch (error) {
      if (error.message.includes('資料不一致') || error.message.includes('觸發器')) {
        throw error;
      }
      console.log('⚠️  workflows_fts 驗證跳過:', error.message);
    }
    
    console.log('✅ 遷移驗證通過');
    return true;
  } catch (error) {
    console.error('❌ 遷移驗證失敗:', error.message);
    return false;
  }
}

/**
 * 執行 v3 到 v4 的遷移
 */
function migrateToV4(db) {
  console.log('🔄 執行 v3 → v4 遷移...');
  
  try {
    // 檢查 FTS5 支援
    const fts5Supported = hasFTS5Support(db);
    console.log(`ℹ️  FTS5 支援: ${fts5Supported ? '是' : '否'}`);
    
    if (!fts5Supported) {
      console.log('⚠️  FTS5 不支援，跳過 workflows_fts 創建');
      updateSchemaVersion(db, SCHEMA_VERSION_TARGET);
      return true;
    }
    
    // 檢查 workflows_fts 是否已存在
    const workflowsFtsExists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='workflows_fts'`).get();
    
    if (workflowsFtsExists) {
      console.log('ℹ️  workflows_fts 表已存在，跳過創建');
      updateSchemaVersion(db, SCHEMA_VERSION_TARGET);
      return true;
    }
    
    console.log('🔧 創建 workflows_fts 虛擬表...');
    
    // 創建 workflows_fts 虛擬表
    db.exec(`
      CREATE VIRTUAL TABLE workflows_fts 
      USING fts5(
        id UNINDEXED,
        name,
        description,
        project_scope UNINDEXED,
        content='workflows',
        content_rowid='rowid',
        tokenize='porter unicode61'
      )
    `);
    
    // 創建觸發器
    console.log('🔧 創建同步觸發器...');
    
    db.exec(`
      CREATE TRIGGER workflows_fts_insert 
      AFTER INSERT ON workflows 
      BEGIN
        INSERT INTO workflows_fts(rowid, id, name, description, project_scope) 
        VALUES (NEW.rowid, NEW.id, NEW.name, COALESCE(NEW.description, ''), NEW.project_scope);
      END
    `);

    db.exec(`
      CREATE TRIGGER workflows_fts_delete 
      AFTER DELETE ON workflows 
      BEGIN
        DELETE FROM workflows_fts WHERE rowid = OLD.rowid;
      END
    `);

    db.exec(`
      CREATE TRIGGER workflows_fts_update 
      AFTER UPDATE ON workflows 
      BEGIN
        INSERT OR REPLACE INTO workflows_fts(rowid, id, name, description, project_scope) 
        VALUES (NEW.rowid, NEW.id, NEW.name, COALESCE(NEW.description, ''), NEW.project_scope);
      END
    `);
    
    // 遷移現有資料
    console.log('📦 遷移現有資料到 workflows_fts...');
    db.exec(`
      INSERT INTO workflows_fts(rowid, id, name, description, project_scope)
      SELECT rowid, id, name, COALESCE(description, ''), project_scope FROM workflows
    `);
    
    // 更新 schema 版本
    updateSchemaVersion(db, SCHEMA_VERSION_TARGET);
    
    console.log('✅ v3 → v4 遷移完成');
    return true;
    
  } catch (error) {
    console.error('❌ v3 → v4 遷移失敗:', error.message);
    
    // 如果是 FTS5 相關錯誤，不要拋出異常
    if (error.message.includes('fts5')) {
      console.warn('⚠️  FTS5 遷移失敗，系統將使用 LIKE 搜尋後備方案');
      updateSchemaVersion(db, SCHEMA_VERSION_TARGET);
      return true;
    }
    
    throw error;
  }
}

/**
 * 主要遷移函數
 */
function performMigration(dbPath) {
  console.log(`🚀 開始遷移資料庫: ${dbPath}`);
  
  // 檢查資料庫檔案是否存在
  if (!fs.existsSync(dbPath)) {
    console.error(`❌ 資料庫檔案不存在: ${dbPath}`);
    process.exit(1);
  }
  
  // 創建備份
  const backupPath = createBackup(dbPath);
  
  let db;
  try {
    // 開啟資料庫連接
    console.log('🔗 連接資料庫...');
    db = new Database(dbPath, { timeout: 30000 });
    
    // 設定資料庫參數
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    
    // 檢查當前版本
    const currentVersion = getCurrentSchemaVersion(db);
    console.log(`ℹ️  當前 schema 版本: ${currentVersion}`);
    
    if (currentVersion >= SCHEMA_VERSION_TARGET) {
      console.log(`✅ 資料庫已是最新版本 (v${currentVersion})，無需遷移`);
      return;
    }
    
    if (currentVersion < 3) {
      console.error(`❌ 資料庫版本過舊 (v${currentVersion})，請先升級到 v3`);
      process.exit(1);
    }
    
    // 執行遷移
    console.log(`🔄 開始從 v${currentVersion} 遷移到 v${SCHEMA_VERSION_TARGET}...`);
    
    // 開始事務
    db.exec('BEGIN TRANSACTION');
    
    try {
      if (currentVersion < 4) {
        migrateToV4(db);
      }
      
      // 提交事務
      db.exec('COMMIT');
      console.log('✅ 事務提交成功');
      
    } catch (error) {
      // 回滾事務
      db.exec('ROLLBACK');
      console.error('❌ 事務回滾');
      throw error;
    }
    
    // 驗證遷移結果
    if (validateMigration(db)) {
      console.log('🎉 遷移成功完成！');
      console.log(`📦 備份檔案: ${backupPath}`);
    } else {
      throw new Error('遷移驗證失敗');
    }
    
  } catch (error) {
    console.error('❌ 遷移失敗:', error.message);
    console.log(`🔄 可以從備份恢復: ${backupPath}`);
    process.exit(1);
    
  } finally {
    if (db) {
      db.close();
      console.log('🔌 資料庫連接已關閉');
    }
  }
}

// 主程式
function main() {
  const args = process.argv.slice(2);
  const dbPath = args[0] || DEFAULT_DB_PATH;
  
  console.log('='.repeat(60));
  console.log('🛠️  Scratchpad MCP v2 - workflows_fts 遷移工具');
  console.log('='.repeat(60));
  
  performMigration(dbPath);
}

// 如果是直接執行此腳本
if (require.main === module) {
  main();
}

module.exports = {
  performMigration,
  hasFTS5Support,
  getCurrentSchemaVersion,
  validateMigration
};