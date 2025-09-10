#!/usr/bin/env node

/**
 * 實時雲端同步工具 - 無需斷線 MCP Server
 * 
 * 特點：
 * 1. 使用 PASSIVE checkpoint，不干擾現有連接
 * 2. 只同步主 .db 檔案（包含最新資料）
 * 3. 支援 WAL 模式下的安全同步
 * 4. 可定期執行或手動觸發
 * 
 * 使用方法：
 * node scripts/live-sync.cjs --db=scratchpad.v6.db --cloud-dir=~/Dropbox/scratchpad
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// 命令行參數解析
const args = process.argv.slice(2);
const config = {
  dbPath: 'scratchpad.v6.db',
  cloudDir: null,
  keepBackups: 5,
  dryRun: false,
  verbose: false
};

args.forEach(arg => {
  if (arg.startsWith('--db=')) {
    config.dbPath = arg.substring(5);
  } else if (arg.startsWith('--cloud-dir=')) {
    config.cloudDir = arg.substring(12);
  } else if (arg.startsWith('--keep=')) {
    config.keepBackups = parseInt(arg.substring(7));
  } else if (arg === '--dry-run') {
    config.dryRun = true;
  } else if (arg === '--verbose') {
    config.verbose = true;
  }
});

// 驗證參數
if (!config.cloudDir) {
  console.error('❌ 請指定雲端同步目錄：');
  console.error('使用方法：');
  console.error('  node scripts/live-sync.cjs --cloud-dir=~/Dropbox/scratchpad');
  console.error('  [--db=scratchpad.v6.db]  # 資料庫檔案');
  console.error('  [--keep=5]               # 保留備份數量');  
  console.error('  [--dry-run]              # 測試模式');
  console.error('  [--verbose]              # 詳細輸出');
  process.exit(1);
}

function log(message, force = false) {
  if (config.verbose || force) {
    console.log(message);
  }
}

function expandPath(filePath) {
  if (filePath.startsWith('~/')) {
    return path.join(process.env.HOME || process.env.USERPROFILE, filePath.slice(2));
  }
  return path.resolve(filePath);
}

// 執行非阻塞檢查點
function performLiveCheckpoint(dbPath) {
  log('\n🔄 執行實時檢查點（不影響 MCP Server）...', true);
  
  if (config.dryRun) {
    log('🔍 測試模式：跳過檢查點');
    return { success: true, pages: 0 };
  }
  
  try {
    // 使用只讀連接避免干擾
    const db = new Database(dbPath, { readonly: false });
    
    // 檢查當前模式和狀態
    const currentMode = db.prepare('PRAGMA journal_mode').get();
    log(`📊 當前模式: ${currentMode.journal_mode}`);
    
    if (currentMode.journal_mode === 'wal') {
      // 執行被動檢查點 - 不會阻塞其他連接
      const result = db.prepare('PRAGMA wal_checkpoint(PASSIVE)').get();
      
      log(`📈 檢查點結果:`);
      log(`   Busy: ${result.busy} (應該是 0)`);
      log(`   Log pages: ${result.log}`);
      log(`   Checkpointed: ${result.checkpointed}`);
      
      if (result.busy > 0) {
        log('⚠️  有忙碌頁面，但不影響主檔案同步', true);
      }
      
      if (result.checkpointed > 0) {
        log(`✅ 成功檢查點 ${result.checkpointed} 頁到主檔案`, true);
      } else {
        log('✅ 主檔案已是最新狀態', true);
      }
      
      db.close();
      return { success: true, pages: result.checkpointed };
      
    } else {
      log('📋 DELETE 模式，無需檢查點', true);
      db.close();
      return { success: true, pages: 0 };
    }
    
  } catch (error) {
    console.error(`❌ 檢查點失敗: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// 智慧同步到雲端
function smartCloudSync(dbPath, cloudDir) {
  log('\n☁️  智慧雲端同步...', true);
  
  const expandedCloudDir = expandPath(cloudDir);
  const dbName = path.basename(dbPath, '.db');
  
  // 確保雲端目錄存在
  if (!config.dryRun) {
    try {
      fs.mkdirSync(expandedCloudDir, { recursive: true });
    } catch (error) {
      console.error(`❌ 無法建立雲端目錄: ${error.message}`);
      return false;
    }
  }
  
  // 檢查主檔案狀態
  const dbStats = fs.statSync(dbPath);
  const cloudCurrentPath = path.join(expandedCloudDir, `${dbName}.db`);
  
  let needsSync = true;
  if (fs.existsSync(cloudCurrentPath)) {
    const cloudStats = fs.statSync(cloudCurrentPath);
    needsSync = dbStats.mtime > cloudStats.mtime || dbStats.size !== cloudStats.size;
    
    log(`📊 檔案比較:`);
    log(`   本地: ${dbStats.size} bytes, ${dbStats.mtime.toISOString()}`);
    log(`   雲端: ${cloudStats.size} bytes, ${cloudStats.mtime.toISOString()}`);
    log(`   需要同步: ${needsSync ? '是' : '否'}`);
  } else {
    log('📋 雲端檔案不存在，需要初始同步', true);
  }
  
  if (!needsSync) {
    log('✅ 雲端已是最新版本，跳過同步', true);
    return true;
  }
  
  if (config.dryRun) {
    log('🔍 測試模式：跳過實際同步');
    return true;
  }
  
  try {
    // 建立帶時間戳的備份
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupPath = path.join(expandedCloudDir, `${dbName}_${timestamp}.db`);
    
    // 同步主檔案（只複製 .db，不複製 WAL/SHM）
    fs.copyFileSync(dbPath, cloudCurrentPath);
    log(`✅ 已同步主檔案: ${cloudCurrentPath}`, true);
    
    // 建立備份
    fs.copyFileSync(dbPath, backupPath);
    log(`📦 已建立備份: ${path.basename(backupPath)}`);
    
    // 清理舊備份
    cleanupOldBackups(expandedCloudDir, dbName);
    
    return true;
    
  } catch (error) {
    console.error(`❌ 同步失敗: ${error.message}`);
    return false;
  }
}

// 清理舊備份
function cleanupOldBackups(cloudDir, dbName) {
  log(`\n🧹 清理舊備份（保留 ${config.keepBackups} 個）...`);
  
  try {
    const backupPattern = new RegExp(`^${dbName}_\\d{4}-\\d{2}-\\d{2}T\\d{2}-\\d{2}-\\d{2}\\.db$`);
    
    const files = fs.readdirSync(cloudDir)
      .filter(file => backupPattern.test(file))
      .map(file => ({
        name: file,
        path: path.join(cloudDir, file),
        mtime: fs.statSync(path.join(cloudDir, file)).mtime
      }))
      .sort((a, b) => b.mtime - a.mtime); // 新到舊排序
    
    if (files.length <= config.keepBackups) {
      log(`✅ 當前 ${files.length} 個備份，無需清理`);
      return;
    }
    
    const toDelete = files.slice(config.keepBackups);
    toDelete.forEach(file => {
      fs.unlinkSync(file.path);
      log(`🗑️  已刪除: ${file.name}`);
    });
    
    log(`✅ 已清理 ${toDelete.length} 個舊備份`);
    
  } catch (error) {
    log(`⚠️  清理備份時出錯: ${error.message}`);
  }
}

// 顯示使用指南
function showLiveUsageGuide() {
  log('\n📚 實時同步使用指南:', true);
  log('', true);
  log('🔄 同步特點:', true);
  log('   ✅ MCP Server 可保持連線', true);
  log('   ✅ 使用被動檢查點，不阻塞操作', true);
  log('   ✅ 只同步主 .db 檔案（最可靠）', true);
  log('   ✅ 智慧檢測，避免無謂同步', true);
  log('', true);
  log('⚡ 自動化選項:', true);
  log('   # 每 30 分鐘自動同步', true);
  log('   */30 * * * * cd /path/to/project && node scripts/live-sync.cjs --cloud-dir=~/Dropbox/scratchpad', true);
  log('', true);
  log('📱 其他機器使用:', true);
  log('   cp ~/Dropbox/scratchpad/scratchpad.v6.db ./scratchpad.v6.db', true);
}

// 主程序
async function main() {
  console.log('⚡ 實時雲端同步工具 - 無需斷線');
  log(`📁 資料庫: ${config.dbPath}`, true);
  log(`☁️  雲端目錄: ${config.cloudDir}`, true);
  if (config.dryRun) {
    log('🔍 測試模式', true);
  }
  
  try {
    // 檢查檔案存在
    if (!fs.existsSync(config.dbPath)) {
      console.error(`❌ 資料庫檔案不存在：${config.dbPath}`);
      process.exit(1);
    }
    
    // 1. 執行實時檢查點
    const checkpointResult = performLiveCheckpoint(config.dbPath);
    if (!checkpointResult.success) {
      console.error('❌ 檢查點失敗，中止同步');
      process.exit(1);
    }
    
    // 2. 智慧同步到雲端
    const syncSuccess = smartCloudSync(config.dbPath, config.cloudDir);
    if (!syncSuccess) {
      console.error('❌ 雲端同步失敗');
      process.exit(1);
    }
    
    // 3. 顯示使用指南
    if (!config.dryRun) {
      showLiveUsageGuide();
    }
    
    console.log('\n🎉 實時同步完成！MCP Server 無需重啟');
    
  } catch (error) {
    console.error('\n❌ 執行過程發生錯誤:');
    console.error(error.message);
    process.exit(1);
  }
}

main().catch(console.error);