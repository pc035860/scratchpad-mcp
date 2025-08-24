#!/usr/bin/env node

/**
 * Scratchpad Database WAL 模式遷移腳本
 * 
 * 目的：將現有的 DELETE 模式資料庫遷移到 WAL 模式
 * 
 * 功能：
 * 1. 安全地將資料庫從 DELETE 模式切換到 WAL 模式
 * 2. 驗證 FTS5 索引完整性
 * 3. 執行完整的健康檢查
 * 4. 確保所有功能正常運作
 * 
 * 執行方式：node scripts/migrate-to-wal.cjs
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(process.cwd(), 'scratchpad.db');

console.log('🔄 Scratchpad Database WAL 模式遷移工具');
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
  console.log('\\n🔍 檢查當前資料庫狀態...');
  
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
  let hasFTS5 = false;
  try {
    const fts = db.prepare('SELECT COUNT(*) as count FROM scratchpads_fts').get();
    ftsCount = fts.count;
    hasFTS5 = true;
    console.log(`   FTS5 索引記錄: ${ftsCount}`);
  } catch (error) {
    console.log(`   FTS5 索引狀態: 不存在或損壞`);
  }
  
  if (currentMode.journal_mode.toLowerCase() === 'wal') {
    console.log('\\n✅ 資料庫已經是 WAL 模式，無需遷移');
    console.log('\\n📊 執行健康檢查...');
    
    // 執行健康檢查
    performHealthCheck(db, hasFTS5);
    
    console.log('\\n🎉 資料庫狀態良好！');
  } else {
    console.log('\\n🔄 開始遷移到 WAL 模式...');
    
    // 步驟 1: 切換到 WAL 模式
    console.log('1️⃣  切換到 WAL 模式...');
    const result = db.prepare('PRAGMA journal_mode=WAL').get();
    console.log(`   ✅ 已切換到 ${result.journal_mode} 模式`);
    
    // 步驟 2: 設定 WAL 模式優化參數
    console.log('2️⃣  設定 WAL 模式優化參數...');
    try {
      db.prepare('PRAGMA wal_autocheckpoint=1000').run();
      console.log(`   ✅ 自動 checkpoint 設定為 1000 頁`);
      
      const checkpointResult = db.prepare('PRAGMA wal_checkpoint(PASSIVE)').get();
      console.log(`   ✅ 執行初始 checkpoint (WAL 頁數: ${checkpointResult.log})`);
    } catch (error) {
      console.warn(`   ⚠️  優化參數設定警告: ${error.message}`);
    }
    
    // 步驟 3: 驗證 FTS5 索引完整性
    if (hasFTS5) {
      console.log('3️⃣  驗證 FTS5 索引完整性...');
      
      const newScratchpadCount = db.prepare('SELECT COUNT(*) as count FROM scratchpads').get();
      const newFtsCount = db.prepare('SELECT COUNT(*) as count FROM scratchpads_fts').get();
      
      if (newScratchpadCount.count === newFtsCount.count) {
        console.log(`   ✅ FTS5 索引完整 (${newFtsCount.count} 記錄)`);
      } else {
        console.warn(`   ⚠️  FTS5 索引不一致: 主表 ${newScratchpadCount.count}, FTS5 ${newFtsCount.count}`);
        console.log('   🔧 重建 FTS5 索引...');
        
        try {
          db.prepare(`INSERT INTO scratchpads_fts(scratchpads_fts) VALUES('rebuild')`).run();
          const rebuiltCount = db.prepare('SELECT COUNT(*) as count FROM scratchpads_fts').get();
          console.log(`   ✅ FTS5 索引重建完成 (${rebuiltCount.count} 記錄)`);
        } catch (error) {
          console.error(`   ❌ FTS5 索引重建失敗: ${error.message}`);
        }
      }
    } else {
      console.log('3️⃣  跳過 FTS5 驗證（無 FTS5 支援）');
    }
    
    // 步驟 4: 功能測試
    console.log('4️⃣  執行功能測試...');
    
    // 測試搜尋功能
    if (hasFTS5) {
      try {
        const searchTest = db.prepare(`
          SELECT COUNT(*) as count 
          FROM scratchpads_fts 
          WHERE scratchpads_fts MATCH 'test OR 測試'
        `).get();
        console.log(`   ✅ FTS5 搜尋功能正常`);
      } catch (error) {
        console.error(`   ❌ FTS5 搜尋測試失敗: ${error.message}`);
      }
    }
    
    // 測試更新操作
    try {
      const testScratchpads = db.prepare('SELECT id FROM scratchpads LIMIT 1').all();
      if (testScratchpads.length > 0) {
        const testId = testScratchpads[0].id;
        const updateTime = new Date().toISOString();
        db.prepare(`
          UPDATE scratchpads 
          SET content = content || '\\n<!-- WAL 模式遷移測試: ${updateTime} -->'
          WHERE id = ?
        `).run(testId);
        console.log(`   ✅ UPDATE 操作功能正常`);
      } else {
        console.log(`   ⚠️  無資料可測試 UPDATE 操作`);
      }
    } catch (error) {
      console.error(`   ❌ UPDATE 操作測試失敗: ${error.message}`);
    }
    
    // 步驟 5: 健康檢查
    console.log('5️⃣  執行健康檢查...');
    performHealthCheck(db, hasFTS5);
    
    console.log('\\n🎉 WAL 模式遷移完成！');
  }
  
  console.log('\\n📊 遷移後狀態:');
  
  const finalMode = db.prepare('PRAGMA journal_mode').get();
  console.log(`   日誌模式: ${finalMode.journal_mode}`);
  
  const finalScratchpadCount = db.prepare('SELECT COUNT(*) as count FROM scratchpads').get();
  console.log(`   Scratchpads: ${finalScratchpadCount.count}`);
  
  if (hasFTS5) {
    const finalFtsCount = db.prepare('SELECT COUNT(*) as count FROM scratchpads_fts').get();
    console.log(`   FTS5 索引: ${finalFtsCount.count}`);
  }
  
  // 檢查觸發器
  const installedTriggers = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type = 'trigger' AND name LIKE 'scratchpads_fts_%'
    ORDER BY name
  `).all();
  
  if (installedTriggers.length > 0) {
    console.log(`   觸發器: ${installedTriggers.map(t => t.name).join(', ')}`);
  }
  
  console.log('\\n✨ 現在可以重新啟動 MCP 伺服器了！');
  
} catch (error) {
  console.error('\\n❌ 遷移過程中發生錯誤:');
  console.error(error.message);
  console.error('\\n🔧 建議操作:');
  console.error('1. 確保 MCP 伺服器已完全關閉');
  console.error('2. 備份資料庫檔案後重試');
  console.error('3. 檢查 SQLite 版本是否支援 WAL 模式');
  process.exit(1);
} finally {
  db.close();
}

/**
 * 執行資料庫健康檢查
 */
function performHealthCheck(db, hasFTS5) {
  try {
    // 檢查 WAL 狀態
    const walInfo = db.prepare('PRAGMA wal_checkpoint(PASSIVE)').get();
    const walPages = walInfo.log;
    const checkpointedPages = walInfo.checkpointed;
    
    console.log(`   ✅ WAL 檔案狀態: ${walPages} 頁 (已 checkpoint: ${checkpointedPages})`);
    
    if (walPages > 1000) {
      console.warn(`   ⚠️  WAL 檔案較大 (${walPages} 頁)，建議執行 checkpoint`);
    }
  } catch (error) {
    console.warn(`   ⚠️  WAL 健康檢查警告: ${error.message}`);
  }
  
  // 檢查資料庫完整性
  try {
    const integrityResult = db.prepare('PRAGMA integrity_check').get();
    if (integrityResult.integrity_check === 'ok') {
      console.log(`   ✅ 資料庫完整性檢查通過`);
    } else {
      console.error(`   ❌ 資料庫完整性問題: ${integrityResult.integrity_check}`);
    }
  } catch (error) {
    console.warn(`   ⚠️  完整性檢查警告: ${error.message}`);
  }
  
  // 檢查 FTS5 健康狀態
  if (hasFTS5) {
    try {
      const mainCount = db.prepare('SELECT COUNT(*) as count FROM scratchpads').get();
      const ftsCount = db.prepare('SELECT COUNT(*) as count FROM scratchpads_fts').get();
      
      if (mainCount.count === ftsCount.count) {
        console.log(`   ✅ FTS5 索引同步狀態良好`);
      } else {
        console.warn(`   ⚠️  FTS5 索引不同步: 主表 ${mainCount.count}, FTS5 ${ftsCount.count}`);
      }
    } catch (error) {
      console.warn(`   ⚠️  FTS5 健康檢查警告: ${error.message}`);
    }
  }
}