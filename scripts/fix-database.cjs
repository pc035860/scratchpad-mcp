#!/usr/bin/env node

/**
 * Scratchpad Database 修復腳本
 * 
 * 修復問題：
 * 1. SQLite WAL 模式與 FTS5 相容性問題
 * 2. FTS5 觸發器不安全問題
 * 
 * 執行方式：node scripts/fix-database.js
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(process.cwd(), 'scratchpad.db');

console.log('🔧 Scratchpad Database 修復工具');
console.log(`📁 資料庫位置: ${dbPath}`);

// 檢查資料庫是否存在
if (!fs.existsSync(dbPath)) {
  console.error('❌ 資料庫檔案不存在！');
  process.exit(1);
}

// 檢查是否有進程在使用資料庫
try {
  const { execSync } = require('child_process');
  const lsofResult = execSync(`lsof "${dbPath}" "${dbPath}-shm" "${dbPath}-wal" 2>/dev/null || true`, 
    { encoding: 'utf8' });
  
  if (lsofResult.trim()) {
    console.error('❌ 資料庫正在被其他進程使用，請先關閉 MCP 伺服器！');
    console.error('使用中的進程:');
    console.error(lsofResult);
    process.exit(1);
  }
} catch (error) {
  // lsof 可能不可用，忽略錯誤
}

const db = new Database(dbPath);

try {
  console.log('\n🔍 檢查當前資料庫狀態...');
  
  // 檢查當前模式
  const currentMode = db.prepare('PRAGMA journal_mode').get();
  console.log(`   當前日誌模式: ${currentMode.journal_mode}`);
  
  // 檢查表格數量
  const scratchpadCount = db.prepare('SELECT COUNT(*) as count FROM scratchpads').get();
  console.log(`   Scratchpads 數量: ${scratchpadCount.count}`);
  
  const workflowCount = db.prepare('SELECT COUNT(*) as count FROM workflows').get();
  console.log(`   Workflows 數量: ${workflowCount.count}`);
  
  // 檢查 FTS5 表是否存在
  let ftsCount = 0;
  try {
    const fts = db.prepare('SELECT COUNT(*) as count FROM scratchpads_fts').get();
    ftsCount = fts.count;
    console.log(`   FTS5 索引記錄: ${ftsCount}`);
  } catch (error) {
    console.log(`   FTS5 索引狀態: 不存在或損壞`);
  }
  
  console.log('\n🔄 開始修復...');
  
  // 步驟 1: 切換到 DELETE 模式
  console.log('1️⃣  切換到 DELETE 模式...');
  const result = db.prepare('PRAGMA journal_mode=DELETE').get();
  console.log(`   ✅ 已切換到 ${result.journal_mode} 模式`);
  
  // 步驟 2: 清理現有 FTS5 設施
  console.log('2️⃣  清理現有 FTS5 設施...');
  const dropStatements = [
    'DROP TRIGGER IF EXISTS scratchpads_fts_update',
    'DROP TRIGGER IF EXISTS scratchpads_fts_insert', 
    'DROP TRIGGER IF EXISTS scratchpads_fts_delete',
    'DROP TABLE IF EXISTS scratchpads_fts'
  ];
  
  dropStatements.forEach((statement, index) => {
    try {
      db.exec(statement);
      console.log(`   ✅ ${statement.split(' ')[2]} 已清理`);
    } catch (error) {
      console.log(`   ⚠️  清理 ${statement.split(' ')[2]} 時出錯: ${error.message}`);
    }
  });
  
  // 步驟 3: 重建 FTS5 表
  console.log('3️⃣  重建 FTS5 表...');
  try {
    db.exec(`
      CREATE VIRTUAL TABLE scratchpads_fts 
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
    console.log('   ✅ FTS5 表創建成功');
  } catch (error) {
    console.error(`   ❌ FTS5 表創建失敗: ${error.message}`);
    throw error;
  }
  
  // 步驟 4: 重建索引內容
  console.log('4️⃣  重建索引內容...');
  try {
    db.exec(`INSERT INTO scratchpads_fts(scratchpads_fts) VALUES('rebuild')`);
    const newFtsCount = db.prepare('SELECT COUNT(*) as count FROM scratchpads_fts').get();
    console.log(`   ✅ FTS5 索引重建完成，記錄數: ${newFtsCount.count}`);
  } catch (error) {
    console.error(`   ❌ 索引重建失敗: ${error.message}`);
    throw error;
  }
  
  // 步驟 5: 創建安全的觸發器
  console.log('5️⃣  創建安全的觸發器...');
  
  const triggers = [
    {
      name: 'INSERT',
      sql: `
        CREATE TRIGGER scratchpads_fts_insert 
        AFTER INSERT ON scratchpads 
        BEGIN
          INSERT INTO scratchpads_fts(rowid, id, workflow_id, title, content) 
          VALUES (NEW.rowid, NEW.id, NEW.workflow_id, NEW.title, NEW.content);
        END
      `
    },
    {
      name: 'DELETE', 
      sql: `
        CREATE TRIGGER scratchpads_fts_delete 
        AFTER DELETE ON scratchpads 
        BEGIN
          DELETE FROM scratchpads_fts WHERE rowid = OLD.rowid;
        END
      `
    },
    {
      name: 'UPDATE',
      sql: `
        CREATE TRIGGER scratchpads_fts_update 
        AFTER UPDATE ON scratchpads 
        BEGIN
          INSERT OR REPLACE INTO scratchpads_fts(rowid, id, workflow_id, title, content) 
          VALUES (NEW.rowid, NEW.id, NEW.workflow_id, NEW.title, NEW.content);
        END
      `
    }
  ];
  
  triggers.forEach(trigger => {
    try {
      db.exec(trigger.sql);
      console.log(`   ✅ ${trigger.name} 觸發器創建成功`);
    } catch (error) {
      console.error(`   ❌ ${trigger.name} 觸發器創建失敗: ${error.message}`);
      throw error;
    }
  });
  
  // 步驟 6: 驗證修復結果
  console.log('6️⃣  驗證修復結果...');
  
  // 測試 FTS5 搜尋
  try {
    const testQuery = db.prepare(`
      SELECT COUNT(*) as count 
      FROM scratchpads_fts 
      WHERE scratchpads_fts MATCH 'test OR 測試'
    `).get();
    console.log(`   ✅ FTS5 搜尋功能正常`);
  } catch (error) {
    console.error(`   ❌ FTS5 搜尋測試失敗: ${error.message}`);
    throw error;
  }
  
  // 測試更新操作
  try {
    const testScratchpads = db.prepare('SELECT id FROM scratchpads LIMIT 1').all();
    if (testScratchpads.length > 0) {
      const testId = testScratchpads[0].id;
      db.prepare(`
        UPDATE scratchpads 
        SET content = content || '\n<!-- 修復測試標記 -->'
        WHERE id = ?
      `).run(testId);
      console.log(`   ✅ UPDATE 操作功能正常`);
    } else {
      console.log(`   ⚠️  無資料可測試 UPDATE 操作`);
    }
  } catch (error) {
    console.error(`   ❌ UPDATE 操作測試失敗: ${error.message}`);
    throw error;
  }
  
  console.log('\n🎉 資料庫修復完成！');
  console.log('\n📊 修復後狀態:');
  
  const finalMode = db.prepare('PRAGMA journal_mode').get();
  console.log(`   日誌模式: ${finalMode.journal_mode}`);
  
  const finalScratchpadCount = db.prepare('SELECT COUNT(*) as count FROM scratchpads').get();
  console.log(`   Scratchpads: ${finalScratchpadCount.count}`);
  
  const finalFtsCount = db.prepare('SELECT COUNT(*) as count FROM scratchpads_fts').get();
  console.log(`   FTS5 索引: ${finalFtsCount.count}`);
  
  // 檢查觸發器
  const installedTriggers = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type = 'trigger' AND name LIKE 'scratchpads_fts_%'
    ORDER BY name
  `).all();
  console.log(`   觸發器: ${installedTriggers.map(t => t.name).join(', ')}`);
  
  console.log('\n✨ 現在可以重新啟動 MCP 伺服器了！');
  
} catch (error) {
  console.error('\n❌ 修復過程中發生錯誤:');
  console.error(error.message);
  console.error('\n🔧 建議操作:');
  console.error('1. 確保 MCP 伺服器已完全關閉');
  console.error('2. 備份資料庫檔案後重試');
  console.error('3. 如果問題持續，可考慮重建資料庫');
  process.exit(1);
} finally {
  db.close();
}