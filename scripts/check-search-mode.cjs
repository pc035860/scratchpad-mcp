#!/usr/bin/env node

/**
 * 檢查搜尋模式腳本
 * 
 * 用途：確認系統是使用 FTS5 還是 LIKE 搜尋
 * 執行：node scripts/check-search-mode.cjs
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(process.cwd(), 'scratchpad.db');

console.log('🔍 Scratchpad 搜尋模式檢查工具');
console.log(`📁 資料庫位置: ${dbPath}`);

if (!fs.existsSync(dbPath)) {
  console.error('❌ 資料庫檔案不存在！');
  process.exit(1);
}

const db = new Database(dbPath, { readonly: true });

try {
  console.log('\\n📊 資料庫狀態檢查...');
  
  // 1. 檢查日誌模式
  const journalMode = db.prepare('PRAGMA journal_mode').get();
  console.log(`   日誌模式: ${journalMode.journal_mode}`);
  
  // 2. 檢查 FTS5 支援
  let hasFTS5 = false;
  
  // 檢查編譯時支援
  let compiledWithFTS5 = false;
  try {
    const compileOptions = db.prepare('PRAGMA compile_options').all();
    compiledWithFTS5 = compileOptions.some(opt => opt.compile_options === 'ENABLE_FTS5');
    console.log(`   FTS5 編譯支援: ${compiledWithFTS5 ? '✅ 是' : '❌ 否'}`);
  } catch (error) {
    console.log(`   FTS5 編譯檢查失敗: ${error.message}`);
  }
  
  // 在非測試環境或 readonly 模式下，直接檢查 FTS5 表是否存在
  console.log(`   NODE_ENV: ${process.env.NODE_ENV || '未設定 (視為生產環境)'}`);
  
  if (compiledWithFTS5) {
    hasFTS5 = true;
    console.log('   FTS5 支援: ✅ 可用 (基於編譯選項)');
  } else {
    console.log('   FTS5 支援: ❌ SQLite 未編譯 FTS5 支援');
  }
  
  // 3. 檢查 FTS5 表是否存在且健康
  let ftsTableExists = false;
  let ftsRecordCount = 0;
  if (hasFTS5) {
    try {
      const ftsCount = db.prepare('SELECT COUNT(*) as count FROM scratchpads_fts').get();
      ftsRecordCount = ftsCount.count;
      ftsTableExists = true;
      console.log(`   FTS5 表狀態: ✅ 存在 (${ftsRecordCount} 記錄)`);
    } catch (error) {
      console.log('   FTS5 表狀態: ❌ 不存在或損壞');
      console.log(`     原因: ${error.message}`);
    }
  }
  
  // 4. 檢查主表記錄數
  const scratchpadCount = db.prepare('SELECT COUNT(*) as count FROM scratchpads').get();
  console.log(`   主表記錄數: ${scratchpadCount.count}`);
  
  // 5. 判斷搜尋模式
  console.log('\\n🎯 搜尋模式分析...');
  
  let searchMode = 'LIKE';
  let canUseFTS5 = false;
  
  if (hasFTS5 && ftsTableExists) {
    if (ftsRecordCount === scratchpadCount.count) {
      searchMode = 'FTS5';
      canUseFTS5 = true;
      console.log('   🚀 使用 FTS5 全文搜尋');
      console.log('   ✅ FTS5 索引與主表同步');
    } else {
      searchMode = 'LIKE (FTS5 索引不同步)';
      console.log('   ⚠️  降級到 LIKE 搜尋');
      console.log(`   📊 主表: ${scratchpadCount.count} 記錄, FTS5: ${ftsRecordCount} 記錄`);
    }
  } else if (hasFTS5 && !ftsTableExists) {
    searchMode = 'LIKE (無 FTS5 表)';
    console.log('   ⚠️  降級到 LIKE 搜尋');
    console.log('   📝 FTS5 支援但表不存在');
  } else {
    searchMode = 'LIKE (無 FTS5 支援)';
    console.log('   ℹ️  使用 LIKE 搜尋');
    console.log('   📝 SQLite 不支援 FTS5 擴展');
  }
  
  // 6. 實際搜尋測試
  console.log('\\n🧪 搜尋功能測試...');
  
  if (canUseFTS5) {
    try {
      // 測試 FTS5 搜尋
      const ftsTest = db.prepare(`
        SELECT COUNT(*) as count 
        FROM scratchpads_fts 
        WHERE scratchpads_fts MATCH ?
      `).get('test OR 測試');
      
      console.log(`   ✅ FTS5 搜尋測試: 找到 ${ftsTest.count} 結果`);
      
      // 測試特殊字符搜尋 (驗證錯誤1修復)
      const specialTest = db.prepare(`
        SELECT COUNT(*) as count 
        FROM scratchpads_fts 
        WHERE scratchpads_fts MATCH ?
      `).get('title:"Claude-MD" OR content:"Claude-MD"');
      
      console.log(`   ✅ 連字號搜尋測試: 找到 ${specialTest.count} 結果`);
      
    } catch (error) {
      console.log(`   ❌ FTS5 搜尋測試失敗: ${error.message}`);
      searchMode = 'LIKE (FTS5 運行時錯誤)';
    }
  }
  
  // LIKE 搜尋測試
  try {
    const likeTest = db.prepare(`
      SELECT COUNT(*) as count 
      FROM scratchpads 
      WHERE title LIKE ? OR content LIKE ?
    `).get('%test%', '%test%');
    
    console.log(`   ✅ LIKE 搜尋測試: 找到 ${likeTest.count} 結果`);
  } catch (error) {
    console.log(`   ❌ LIKE 搜尋測試失敗: ${error.message}`);
  }
  
  // 7. WAL 模式檢查 (新增)
  if (journalMode.journal_mode.toLowerCase() === 'wal') {
    console.log('\\n📈 WAL 模式狀態...');
    try {
      const walInfo = db.prepare('PRAGMA wal_checkpoint(PASSIVE)').get();
      console.log(`   WAL 檔案: ${walInfo.log} 頁`);
      console.log(`   已同步: ${walInfo.checkpointed} 頁`);
      
      if (walInfo.log > 100) {
        console.log('   ⚠️  建議執行 checkpoint (WAL 檔案較大)');
      } else {
        console.log('   ✅ WAL 檔案大小正常');
      }
    } catch (error) {
      console.log(`   ⚠️  WAL 狀態檢查失敗: ${error.message}`);
    }
  }
  
  // 8. 總結
  console.log('\\n📋 總結報告');
  console.log('━'.repeat(50));
  console.log(`🔍 搜尋模式: ${searchMode}`);
  console.log(`📊 資料量: ${scratchpadCount.count} 個 scratchpads`);
  console.log(`💾 日誌模式: ${journalMode.journal_mode.toUpperCase()}`);
  console.log(`⚡ FTS5 可用: ${canUseFTS5 ? '是' : '否'}`);
  
  if (canUseFTS5) {
    console.log('\\n🎉 系統使用高效的 FTS5 全文搜尋！');
    console.log('   • 支援複雜查詢語法');
    console.log('   • 更快的搜尋速度');
    console.log('   • 更好的相關性排序');
  } else {
    console.log('\\n💡 系統使用 LIKE 搜尋作為後備方案');
    console.log('   • 基本關鍵字搜尋');
    console.log('   • 功能完整但效能略低');
    console.log('   • 適合小到中型資料集');
  }
  
  console.log('\\n✨ 檢查完成！');
  
} catch (error) {
  console.error('\\n❌ 檢查過程中發生錯誤:');
  console.error(error.message);
  process.exit(1);
} finally {
  db.close();
}