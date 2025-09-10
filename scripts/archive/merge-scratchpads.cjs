#!/usr/bin/env node

/**
 * Scratchpads 專門合併工具
 * 
 * 針對已存在相同 workflow ID 的情況，安全地合併 scratchpads
 * 
 * 使用方法：
 * node scripts/merge-scratchpads.cjs --source=scratchpad.db --target=scratchpad.v6.db
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// 命令行參數解析
const args = process.argv.slice(2);
const config = {
  source: null,
  target: null,
  dryRun: false
};

args.forEach(arg => {
  if (arg.startsWith('--source=')) {
    config.source = arg.substring(9);
  } else if (arg.startsWith('--target=')) {
    config.target = arg.substring(9);
  } else if (arg === '--dry-run') {
    config.dryRun = true;
  }
});

// 驗證參數
if (!config.source || !config.target) {
  console.error('❌ 請指定來源和目標資料庫：');
  console.error('  --source=/path/to/source.db');
  console.error('  --target=/path/to/target.db');
  console.error('  [--dry-run]  # 只檢查不執行');
  process.exit(1);
}

if (!fs.existsSync(config.source)) {
  console.error(`❌ 來源資料庫不存在：${config.source}`);
  process.exit(1);
}

if (!fs.existsSync(config.target)) {
  console.error(`❌ 目標資料庫不存在：${config.target}`);
  process.exit(1);
}

console.log('🔄 Scratchpads 專門合併工具');
console.log(`📁 來源資料庫: ${config.source}`);
console.log(`📁 目標資料庫: ${config.target}`);
if (config.dryRun) {
  console.log('🔍 模式: 乾運行（只檢查不執行）');
}

// 檢查資料庫使用狀況
function checkDatabaseInUse(dbPath) {
  try {
    const { execSync } = require('child_process');
    const lsofResult = execSync(
      `lsof "${dbPath}" "${dbPath}-shm" "${dbPath}-wal" 2>/dev/null || true`, 
      { encoding: 'utf8' }
    );
    
    if (lsofResult.trim()) {
      console.error(`❌ 資料庫正在使用中：${dbPath}`);
      console.error('請先關閉所有 MCP 伺服器！');
      return true;
    }
    return false;
  } catch (error) {
    console.warn(`⚠️  無法檢查 ${dbPath} 使用狀況`);
    return false;
  }
}

// 分析 scratchpads 合併情況
function analyzeScratchpads(sourceDb, targetDb) {
  console.log('\n📊 分析 scratchpads 合併情況...');
  
  // 1. 載入來源 scratchpads
  const sourceScratchpads = sourceDb.prepare(`
    SELECT s.*, w.name as workflow_name 
    FROM scratchpads s 
    JOIN workflows w ON s.workflow_id = w.id 
    ORDER BY w.name, s.created_at
  `).all();
  
  // 2. 載入目標 scratchpads
  const targetScratchpads = targetDb.prepare(`
    SELECT id, workflow_id, title 
    FROM scratchpads
  `).all();
  
  const targetScratchpadIds = new Set(targetScratchpads.map(s => s.id));
  const targetWorkflowIds = new Set(
    targetDb.prepare('SELECT id FROM workflows').all().map(w => w.id)
  );
  
  console.log(`📋 來源 scratchpads: ${sourceScratchpads.length} 筆`);
  console.log(`📋 目標 scratchpads: ${targetScratchpads.length} 筆`);
  
  // 3. 分析每個 scratchpad
  const analysis = {
    canMerge: [],
    needNewId: [],
    missingWorkflow: [],
    duplicate: []
  };
  
  sourceScratchpads.forEach(scratchpad => {
    const hasWorkflow = targetWorkflowIds.has(scratchpad.workflow_id);
    const hasId = targetScratchpadIds.has(scratchpad.id);
    
    if (!hasWorkflow) {
      analysis.missingWorkflow.push(scratchpad);
    } else if (hasId) {
      analysis.duplicate.push(scratchpad);
    } else {
      analysis.canMerge.push(scratchpad);
    }
  });
  
  // 4. 顯示分析結果
  console.log('\n🔍 分析結果：');
  console.log(`   ✅ 可直接合併: ${analysis.canMerge.length} 筆`);
  console.log(`   ⚠️  重複 ID: ${analysis.duplicate.length} 筆`);
  console.log(`   ❌ 缺少 workflow: ${analysis.missingWorkflow.length} 筆`);
  
  if (analysis.missingWorkflow.length > 0) {
    console.log('\n❌ 缺少的 workflows：');
    const missingWorkflows = new Set(analysis.missingWorkflow.map(s => s.workflow_name));
    missingWorkflows.forEach(name => console.log(`   - ${name}`));
  }
  
  if (analysis.duplicate.length > 0) {
    console.log('\n⚠️  重複的 scratchpads：');
    analysis.duplicate.forEach(s => {
      console.log(`   - ${s.title} (${s.workflow_name})`);
    });
  }
  
  if (analysis.canMerge.length > 0) {
    console.log('\n✅ 可合併的 scratchpads：');
    analysis.canMerge.forEach(s => {
      console.log(`   - ${s.title} (${s.workflow_name})`);
    });
  }
  
  return analysis;
}

// 執行 scratchpads 合併
function mergeScratchpads(sourceDb, targetDb, analysis) {
  if (config.dryRun) {
    console.log('\n🔍 乾運行模式，不執行實際合併');
    return { merged: 0, skipped: analysis.duplicate.length + analysis.missingWorkflow.length };
  }
  
  console.log('\n🚀 開始合併 scratchpads...');
  
  const insertScratchpad = targetDb.prepare(`
    INSERT INTO scratchpads (id, workflow_id, title, content, created_at, updated_at, size_bytes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  let merged = 0;
  let errors = 0;
  
  targetDb.exec('BEGIN TRANSACTION');
  
  try {
    analysis.canMerge.forEach(scratchpad => {
      try {
        insertScratchpad.run(
          scratchpad.id,
          scratchpad.workflow_id,
          scratchpad.title,
          scratchpad.content,
          scratchpad.created_at,
          scratchpad.updated_at,
          scratchpad.size_bytes
        );
        merged++;
        console.log(`   ✅ ${scratchpad.title} (${scratchpad.workflow_name})`);
      } catch (error) {
        errors++;
        console.warn(`   ❌ ${scratchpad.title}: ${error.message}`);
      }
    });
    
    if (errors === 0) {
      targetDb.exec('COMMIT');
      console.log(`\n🎉 成功合併 ${merged} 個 scratchpads！`);
    } else {
      targetDb.exec('ROLLBACK');
      console.error(`\n❌ 合併失敗，發生 ${errors} 個錯誤，已回滾變更`);
      return { merged: 0, skipped: analysis.canMerge.length };
    }
    
  } catch (error) {
    targetDb.exec('ROLLBACK');
    console.error(`\n❌ 合併過程發生錯誤：${error.message}`);
    return { merged: 0, skipped: analysis.canMerge.length };
  }
  
  return { 
    merged, 
    skipped: analysis.duplicate.length + analysis.missingWorkflow.length,
    errors 
  };
}

// 重建 FTS5 索引
function rebuildFTS5Index(db) {
  console.log('\n🔍 重建 FTS5 索引...');
  
  try {
    // 重建索引內容
    db.exec(`INSERT INTO scratchpads_fts(scratchpads_fts) VALUES('rebuild')`);
    
    const ftsCount = db.prepare('SELECT COUNT(*) as count FROM scratchpads_fts').get();
    console.log(`✅ FTS5 索引重建完成，記錄數：${ftsCount.count}`);
    
  } catch (error) {
    console.warn(`⚠️  FTS5 索引重建失敗：${error.message}`);
    console.warn('搜尋功能可能受影響，但基本功能正常');
  }
}

// 主程序
async function main() {
  // 檢查資料庫使用狀況
  if (checkDatabaseInUse(config.source) || checkDatabaseInUse(config.target)) {
    process.exit(1);
  }
  
  const sourceDb = new Database(config.source, { readonly: true });
  const targetDb = new Database(config.target, { readonly: config.dryRun });
  
  try {
    // 1. 分析合併情況
    const analysis = analyzeScratchpads(sourceDb, targetDb);
    
    if (analysis.canMerge.length === 0) {
      console.log('\n✨ 沒有可合併的 scratchpads，工作完成！');
      return;
    }
    
    // 2. 執行合併
    const result = mergeScratchpads(sourceDb, targetDb, analysis);
    
    // 3. 重建索引（非乾運行模式）
    if (!config.dryRun && result.merged > 0) {
      rebuildFTS5Index(targetDb);
    }
    
    // 4. 最終結果
    console.log('\n📊 最終結果：');
    console.log(`   ✅ 已合併: ${result.merged} 個 scratchpads`);
    console.log(`   ⚠️  已跳過: ${result.skipped} 個 scratchpads`);
    
    if (result.merged > 0) {
      const finalCount = targetDb.prepare('SELECT COUNT(*) as count FROM scratchpads').get();
      console.log(`   📋 目標資料庫總計: ${finalCount.count} 個 scratchpads`);
    }
    
  } catch (error) {
    console.error('\n❌ 執行過程發生錯誤：');
    console.error(error.message);
    process.exit(1);
  } finally {
    sourceDb.close();
    targetDb.close();
  }
}

main().catch(console.error);