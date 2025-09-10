#!/usr/bin/env node

/**
 * Scratchpad 資料庫合併工具
 * 
 * 支援三種合併策略：
 * 1. smart - 智慧合併（推薦）
 * 2. namespace - 命名空間合併
 * 3. simple - 簡單合併
 * 
 * 使用方法：
 * node scripts/merge-databases.cjs --source=/path/to/source.db --strategy=smart [--project-scope=new-project]
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// 命令行參數解析
const args = process.argv.slice(2);
const config = {
  target: path.join(process.cwd(), 'scratchpad.db'),
  source: null,
  strategy: 'smart',
  projectScope: null,
  prefix: 'MERGED'
};

args.forEach(arg => {
  if (arg.startsWith('--source=')) {
    config.source = arg.substring(9);
  } else if (arg.startsWith('--target=')) {
    config.target = arg.substring(9);
  } else if (arg.startsWith('--strategy=')) {
    config.strategy = arg.substring(11);
  } else if (arg.startsWith('--project-scope=')) {
    config.projectScope = arg.substring(16);
  } else if (arg.startsWith('--prefix=')) {
    config.prefix = arg.substring(9);
  }
});

// 驗證參數
if (!config.source) {
  console.error('❌ 請指定來源資料庫路徑：--source=/path/to/source.db');
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

if (!['smart', 'namespace', 'simple'].includes(config.strategy)) {
  console.error('❌ 不支援的合併策略，請使用：smart, namespace, simple');
  process.exit(1);
}

console.log('🔄 Scratchpad 資料庫合併工具');
console.log(`📁 來源資料庫: ${config.source}`);
console.log(`📁 目標資料庫: ${config.target}`);
console.log(`📋 合併策略: ${config.strategy}`);
if (config.projectScope) {
  console.log(`🏷️  專案範圍: ${config.projectScope}`);
}

// 檢查資料庫是否正在使用
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
      process.exit(1);
    }
  } catch (error) {
    // lsof 可能不可用，忽略
  }
}

// 生成新的 UUID（不與現有 ID 衝突）
function generateNewId(existingIds) {
  let newId;
  do {
    newId = crypto.randomUUID();
  } while (existingIds.has(newId));
  existingIds.add(newId);
  return newId;
}

// 智慧合併策略
function smartMerge(sourceDb, targetDb) {
  console.log('\n🧠 執行智慧合併...');
  
  // 1. 載入目標資料庫現有 ID
  const existingWorkflowIds = new Set(
    targetDb.prepare('SELECT id FROM workflows').all().map(row => row.id)
  );
  const existingScratchpadIds = new Set(
    targetDb.prepare('SELECT id FROM scratchpads').all().map(row => row.id)
  );
  
  // 2. 載入來源資料
  const sourceWorkflows = sourceDb.prepare(`
    SELECT * FROM workflows ORDER BY created_at
  `).all();
  
  const sourceScratchpads = sourceDb.prepare(`
    SELECT * FROM scratchpads ORDER BY created_at
  `).all();
  
  console.log(`📊 來源資料：${sourceWorkflows.length} workflows, ${sourceScratchpads.length} scratchpads`);
  
  // 3. ID 映射表
  const workflowIdMap = new Map();
  
  // 4. 合併 workflows
  const insertWorkflow = targetDb.prepare(`
    INSERT INTO workflows (id, name, description, created_at, updated_at, scratchpad_count, is_active, project_scope)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  let mergedWorkflows = 0;
  sourceWorkflows.forEach(workflow => {
    const newId = existingWorkflowIds.has(workflow.id) 
      ? generateNewId(existingWorkflowIds)
      : workflow.id;
    
    workflowIdMap.set(workflow.id, newId);
    
    const projectScope = config.projectScope || workflow.project_scope;
    
    try {
      insertWorkflow.run(
        newId,
        workflow.name,
        workflow.description,
        workflow.created_at,
        workflow.updated_at,
        workflow.scratchpad_count,
        workflow.is_active,
        projectScope
      );
      mergedWorkflows++;
    } catch (error) {
      console.warn(`⚠️  跳過 workflow ${workflow.name}: ${error.message}`);
    }
  });
  
  // 5. 合併 scratchpads
  const insertScratchpad = targetDb.prepare(`
    INSERT INTO scratchpads (id, workflow_id, title, content, created_at, updated_at, size_bytes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  let mergedScratchpads = 0;
  sourceScratchpads.forEach(scratchpad => {
    const newId = existingScratchpadIds.has(scratchpad.id)
      ? generateNewId(existingScratchpadIds)
      : scratchpad.id;
    
    const newWorkflowId = workflowIdMap.get(scratchpad.workflow_id);
    if (!newWorkflowId) {
      console.warn(`⚠️  跳過 scratchpad ${scratchpad.title}: 找不到對應的 workflow`);
      return;
    }
    
    try {
      insertScratchpad.run(
        newId,
        newWorkflowId,
        scratchpad.title,
        scratchpad.content,
        scratchpad.created_at,
        scratchpad.updated_at,
        scratchpad.size_bytes
      );
      mergedScratchpads++;
    } catch (error) {
      console.warn(`⚠️  跳過 scratchpad ${scratchpad.title}: ${error.message}`);
    }
  });
  
  console.log(`✅ 智慧合併完成：${mergedWorkflows} workflows, ${mergedScratchpads} scratchpads`);
  return { workflows: mergedWorkflows, scratchpads: mergedScratchpads };
}

// 命名空間合併策略
function namespaceMerge(sourceDb, targetDb) {
  console.log('\n🏷️  執行命名空間合併...');
  
  const existingWorkflowIds = new Set(
    targetDb.prepare('SELECT id FROM workflows').all().map(row => row.id)
  );
  const existingScratchpadIds = new Set(
    targetDb.prepare('SELECT id FROM scratchpads').all().map(row => row.id)
  );
  
  const sourceWorkflows = sourceDb.prepare('SELECT * FROM workflows ORDER BY created_at').all();
  const sourceScratchpads = sourceDb.prepare('SELECT * FROM scratchpads ORDER BY created_at').all();
  
  const workflowIdMap = new Map();
  
  const insertWorkflow = targetDb.prepare(`
    INSERT INTO workflows (id, name, description, created_at, updated_at, scratchpad_count, is_active, project_scope)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  let mergedWorkflows = 0;
  sourceWorkflows.forEach(workflow => {
    const newId = generateNewId(existingWorkflowIds);
    workflowIdMap.set(workflow.id, newId);
    
    const prefixedName = `[${config.prefix}] ${workflow.name}`;
    const prefixedScope = config.projectScope || 
      (workflow.project_scope ? `${config.prefix.toLowerCase()}-${workflow.project_scope}` : null);
    
    try {
      insertWorkflow.run(
        newId,
        prefixedName,
        workflow.description,
        workflow.created_at,
        workflow.updated_at,
        workflow.scratchpad_count,
        workflow.is_active,
        prefixedScope
      );
      mergedWorkflows++;
    } catch (error) {
      console.warn(`⚠️  跳過 workflow ${workflow.name}: ${error.message}`);
    }
  });
  
  const insertScratchpad = targetDb.prepare(`
    INSERT INTO scratchpads (id, workflow_id, title, content, created_at, updated_at, size_bytes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  let mergedScratchpads = 0;
  sourceScratchpads.forEach(scratchpad => {
    const newId = generateNewId(existingScratchpadIds);
    const newWorkflowId = workflowIdMap.get(scratchpad.workflow_id);
    
    if (newWorkflowId) {
      try {
        insertScratchpad.run(
          newId,
          newWorkflowId,
          scratchpad.title,
          scratchpad.content,
          scratchpad.created_at,
          scratchpad.updated_at,
          scratchpad.size_bytes
        );
        mergedScratchpads++;
      } catch (error) {
        console.warn(`⚠️  跳過 scratchpad ${scratchpad.title}: ${error.message}`);
      }
    }
  });
  
  console.log(`✅ 命名空間合併完成：${mergedWorkflows} workflows, ${mergedScratchpads} scratchpads`);
  return { workflows: mergedWorkflows, scratchpads: mergedScratchpads };
}

// 簡單合併策略
function simpleMerge(sourceDb, targetDb) {
  console.log('\n⚡ 執行簡單合併...');
  
  try {
    // 直接複製，忽略衝突
    targetDb.exec(`
      INSERT OR IGNORE INTO workflows 
      SELECT * FROM source.workflows
    `);
    
    targetDb.exec(`
      INSERT OR IGNORE INTO scratchpads 
      SELECT * FROM source.scratchpads
    `);
    
    const mergedWorkflows = targetDb.changes;
    console.log(`✅ 簡單合併完成（忽略衝突）`);
    return { workflows: '未知', scratchpads: '未知' };
  } catch (error) {
    console.error(`❌ 簡單合併失敗: ${error.message}`);
    throw error;
  }
}

// 重建 FTS5 索引
function rebuildFTS5Index(db) {
  console.log('\n🔍 重建 FTS5 索引...');
  
  try {
    // 清理現有 FTS5
    db.exec('DROP TABLE IF EXISTS scratchpads_fts');
    
    // 重建 FTS5 表
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
    
    // 重建索引內容
    db.exec(`INSERT INTO scratchpads_fts(scratchpads_fts) VALUES('rebuild')`);
    
    const ftsCount = db.prepare('SELECT COUNT(*) as count FROM scratchpads_fts').get();
    console.log(`✅ FTS5 索引重建完成，記錄數：${ftsCount.count}`);
    
    // 重建觸發器
    const triggers = [
      `CREATE TRIGGER scratchpads_fts_insert 
       AFTER INSERT ON scratchpads 
       BEGIN
         INSERT INTO scratchpads_fts(rowid, id, workflow_id, title, content) 
         VALUES (NEW.rowid, NEW.id, NEW.workflow_id, NEW.title, NEW.content);
       END`,
      `CREATE TRIGGER scratchpads_fts_delete 
       AFTER DELETE ON scratchpads 
       BEGIN
         DELETE FROM scratchpads_fts WHERE rowid = OLD.rowid;
       END`,
      `CREATE TRIGGER scratchpads_fts_update 
       AFTER UPDATE ON scratchpads 
       BEGIN
         INSERT OR REPLACE INTO scratchpads_fts(rowid, id, workflow_id, title, content) 
         VALUES (NEW.rowid, NEW.id, NEW.workflow_id, NEW.title, NEW.content);
       END`
    ];
    
    triggers.forEach(trigger => db.exec(trigger));
    console.log('✅ FTS5 觸發器重建完成');
    
  } catch (error) {
    console.warn(`⚠️  FTS5 索引重建失敗：${error.message}`);
    console.warn('搜尋功能可能受影響，但基本功能正常');
  }
}

// 主程序
async function main() {
  checkDatabaseInUse(config.source);
  checkDatabaseInUse(config.target);
  
  const sourceDb = new Database(config.source, { readonly: true });
  const targetDb = new Database(config.target);
  
  try {
    console.log('\n📊 合併前狀態檢查...');
    
    // 來源資料庫狀態
    const sourceWorkflowCount = sourceDb.prepare('SELECT COUNT(*) as count FROM workflows').get();
    const sourceScratchpadCount = sourceDb.prepare('SELECT COUNT(*) as count FROM scratchpads').get();
    console.log(`來源：${sourceWorkflowCount.count} workflows, ${sourceScratchpadCount.count} scratchpads`);
    
    // 目標資料庫狀態
    const targetWorkflowCount = targetDb.prepare('SELECT COUNT(*) as count FROM workflows').get();
    const targetScratchpadCount = targetDb.prepare('SELECT COUNT(*) as count FROM scratchpads').get();
    console.log(`目標：${targetWorkflowCount.count} workflows, ${targetScratchpadCount.count} scratchpads`);
    
    // 設定事務
    targetDb.pragma('journal_mode = DELETE'); // 暫時切換到 DELETE 模式確保穩定性
    targetDb.exec('BEGIN TRANSACTION');
    
    // 對於簡單模式，需要 ATTACH
    if (config.strategy === 'simple') {
      targetDb.exec(`ATTACH DATABASE '${config.source}' AS source`);
    }
    
    let result;
    switch (config.strategy) {
      case 'smart':
        result = smartMerge(sourceDb, targetDb);
        break;
      case 'namespace':
        result = namespaceMerge(sourceDb, targetDb);
        break;
      case 'simple':
        result = simpleMerge(sourceDb, targetDb);
        break;
    }
    
    targetDb.exec('COMMIT');
    
    // 重建 FTS5 索引
    rebuildFTS5Index(targetDb);
    
    // 最終狀態檢查
    console.log('\n📊 合併後狀態檢查...');
    const finalWorkflowCount = targetDb.prepare('SELECT COUNT(*) as count FROM workflows').get();
    const finalScratchpadCount = targetDb.prepare('SELECT COUNT(*) as count FROM scratchpads').get();
    console.log(`最終：${finalWorkflowCount.count} workflows, ${finalScratchpadCount.count} scratchpads`);
    
    console.log('\n🎉 資料庫合併成功！');
    console.log(`✨ 新增：${result.workflows} workflows, ${result.scratchpads} scratchpads`);
    
  } catch (error) {
    targetDb.exec('ROLLBACK');
    console.error('\n❌ 合併過程發生錯誤：');
    console.error(error.message);
    console.error('\n🔧 建議操作：');
    console.error('1. 檢查來源資料庫完整性');
    console.error('2. 確保目標資料庫有足夠空間');
    console.error('3. 備份後重試');
    process.exit(1);
  } finally {
    sourceDb.close();
    targetDb.close();
  }
}

main().catch(console.error);