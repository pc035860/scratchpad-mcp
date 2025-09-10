#!/usr/bin/env node

/**
 * 資料庫 WAL 檢查點工具
 * 
 * 功能：
 * 1. 將 WAL 檔案的變更合併回主資料庫
 * 2. 清理 WAL 和 SHM 檔案
 * 3. 可選擇切換到 DELETE 模式
 * 
 * 使用方法：
 * node scripts/checkpoint-database.cjs [--delete-mode] [--db-path=/path/to/db]
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// 命令行參數解析
const args = process.argv.slice(2);
const config = {
  dbPath: path.join(process.cwd(), 'scratchpad.db'),
  deleteMode: false
};

args.forEach(arg => {
  if (arg === '--delete-mode') {
    config.deleteMode = true;
  } else if (arg.startsWith('--db-path=')) {
    config.dbPath = arg.substring(10);
  }
});

console.log('🔄 資料庫 WAL 檢查點工具');
console.log(`📁 資料庫路徑: ${config.dbPath}`);

// 檢查檔案存在
if (!fs.existsSync(config.dbPath)) {
  console.error(`❌ 資料庫檔案不存在：${config.dbPath}`);
  process.exit(1);
}

// 檢查相關檔案狀態
function checkDatabaseFiles(dbPath) {
  const files = {
    main: dbPath,
    wal: `${dbPath}-wal`,
    shm: `${dbPath}-shm`
  };
  
  console.log('\n📊 檔案狀態檢查：');
  
  Object.entries(files).forEach(([type, filePath]) => {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const sizeKB = (stats.size / 1024).toFixed(1);
      console.log(`   ${type.toUpperCase()}: ${sizeKB}KB (${filePath})`);
    } else {
      console.log(`   ${type.toUpperCase()}: 不存在`);
    }
  });
  
  return files;
}

// 檢查資料庫是否被使用
function checkDatabaseInUse(dbPath) {
  try {
    const { execSync } = require('child_process');
    const lsofResult = execSync(
      `lsof "${dbPath}" "${dbPath}-shm" "${dbPath}-wal" 2>/dev/null || true`, 
      { encoding: 'utf8' }
    );
    
    if (lsofResult.trim()) {
      console.error(`❌ 資料庫正在使用中！請先關閉 MCP 伺服器。`);
      console.error('使用中的進程：');
      console.error(lsofResult);
      return true;
    }
    return false;
  } catch (error) {
    // lsof 可能不可用，繼續執行但發出警告
    console.warn('⚠️  無法檢查進程使用狀況，請確保 MCP 伺服器已關閉');
    return false;
  }
}

// 執行 WAL 檢查點
function performCheckpoint(db) {
  console.log('\n🔄 執行 WAL 檢查點...');
  
  try {
    // 檢查當前模式
    const currentMode = db.prepare('PRAGMA journal_mode').get();
    console.log(`   當前模式: ${currentMode.journal_mode}`);
    
    // 執行 WAL 檢查點
    const checkpointResult = db.prepare('PRAGMA wal_checkpoint(FULL)').get();
    console.log(`   檢查點結果: busy=${checkpointResult.busy}, log=${checkpointResult.log}, checkpointed=${checkpointResult.checkpointed}`);
    
    if (checkpointResult.busy > 0) {
      console.warn('⚠️  檢查點執行時資料庫忙碌，可能有未完成的事務');
    }
    
    if (checkpointResult.log > 0) {
      console.log(`   ✅ 成功將 ${checkpointResult.log} 頁從 WAL 寫入主資料庫`);
    } else {
      console.log('   ✅ WAL 檔案已是最新狀態，無需檢查點');
    }
    
    return checkpointResult;
    
  } catch (error) {
    console.error(`   ❌ 檢查點執行失敗: ${error.message}`);
    throw error;
  }
}

// 切換到 DELETE 模式
function switchToDeleteMode(db) {
  console.log('\n🔄 切換到 DELETE 模式...');
  
  try {
    const result = db.prepare('PRAGMA journal_mode=DELETE').get();
    console.log(`   ✅ 已切換到 ${result.journal_mode} 模式`);
    return result;
  } catch (error) {
    console.error(`   ❌ 模式切換失敗: ${error.message}`);
    throw error;
  }
}

// 驗證資料完整性
function verifyIntegrity(db) {
  console.log('\n🔍 驗證資料完整性...');
  
  try {
    // 檢查資料庫完整性
    const integrityResult = db.prepare('PRAGMA integrity_check').get();
    if (integrityResult.integrity_check === 'ok') {
      console.log('   ✅ 資料庫完整性檢查通過');
    } else {
      console.warn(`   ⚠️  完整性檢查異常: ${integrityResult.integrity_check}`);
    }
    
    // 檢查資料統計
    const workflowCount = db.prepare('SELECT COUNT(*) as count FROM workflows').get();
    const scratchpadCount = db.prepare('SELECT COUNT(*) as count FROM scratchpads').get();
    console.log(`   📊 資料統計: ${workflowCount.count} workflows, ${scratchpadCount.count} scratchpads`);
    
    // 如果有 FTS5，檢查索引
    try {
      const ftsCount = db.prepare('SELECT COUNT(*) as count FROM scratchpads_fts').get();
      console.log(`   🔍 FTS5 索引: ${ftsCount.count} 記錄`);
    } catch (error) {
      console.log('   🔍 FTS5 索引: 不存在或不可用');
    }
    
    return true;
  } catch (error) {
    console.error(`   ❌ 完整性檢查失敗: ${error.message}`);
    return false;
  }
}

// 主程序
async function main() {
  const files = checkDatabaseFiles(config.dbPath);
  
  // 檢查是否有 WAL 檔案需要處理
  const hasWal = fs.existsSync(files.wal);
  const hasShm = fs.existsSync(files.shm);
  
  if (!hasWal && !hasShm) {
    console.log('\n✅ 資料庫已經是乾淨狀態，無 WAL/SHM 檔案');
    process.exit(0);
  }
  
  // 檢查資料庫使用狀況
  if (checkDatabaseInUse(config.dbPath)) {
    process.exit(1);
  }
  
  console.log('\n🚀 開始處理 WAL 檔案...');
  
  const db = new Database(config.dbPath);
  
  try {
    // 1. 執行檢查點
    const checkpointResult = performCheckpoint(db);
    
    // 2. 如果需要，切換模式
    if (config.deleteMode) {
      switchToDeleteMode(db);
    }
    
    // 3. 驗證完整性
    const isValid = verifyIntegrity(db);
    
    if (!isValid) {
      console.error('❌ 資料完整性檢查失敗，請檢查資料庫狀態');
      process.exit(1);
    }
    
    console.log('\n🎉 WAL 檢查點完成！');
    
  } catch (error) {
    console.error('\n❌ 處理過程發生錯誤：');
    console.error(error.message);
    console.error('\n🔧 建議操作：');
    console.error('1. 確保沒有進程在使用資料庫');
    console.error('2. 檢查資料庫檔案權限');
    console.error('3. 考慮備份後重試');
    process.exit(1);
  } finally {
    db.close();
  }
  
  // 4. 檢查檔案清理結果
  console.log('\n📊 處理後檔案狀態：');
  checkDatabaseFiles(config.dbPath);
  
  // 如果切換到 DELETE 模式，WAL/SHM 檔案應該已被清理
  if (config.deleteMode) {
    const walExists = fs.existsSync(files.wal);
    const shmExists = fs.existsSync(files.shm);
    
    if (walExists || shmExists) {
      console.warn('⚠️  WAL/SHM 檔案仍存在，可能需要手動清理');
    } else {
      console.log('✅ WAL/SHM 檔案已成功清理');
    }
  }
  
  console.log('\n✨ 現在可以安全地使用此資料庫進行合併操作！');
}

main().catch(console.error);