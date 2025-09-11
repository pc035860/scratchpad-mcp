# search-workflows 工具設計規格

## 概述
將現有的 `search-scratchpads` 工具改寫為 `search-workflows` 工具，改變搜尋目標從 scratchpads 改為 workflows，並加入新的評分排序機制。

## 現有架構分析

### 當前 search-scratchpads 架構
- **搜尋對象**: scratchpads 表 + FTS5 索引 (`scratchpads_fts`)
- **四層降級**: jieba_query → simple_query → 標準FTS5 → LIKE搜尋
- **中文支援**: 自動檢測中文內容並選擇最佳分詞器
- **Context功能**: 提供行級上下文、範圍合併、格式化輸出
- **分頁機制**: limit/offset 參數，最大50項

### 資料庫表結構
```sql
-- workflows 表
CREATE TABLE workflows (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    project_scope TEXT,
    is_active BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- scratchpads 表 (用於評分)
CREATE TABLE scratchpads (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workflow_id) REFERENCES workflows(id)
);
```

## 新規格需求

### 1. 工具基本資訊
- **工具名稱**: `search-workflows`
- **搜尋對象**: workflows 表 (取代 scratchpads 搜尋)
- **移除功能**: Context 內容搜尋 (交給已完成的 search-scratchpad-content 工具)

### 2. 搜尋邏輯 (已更新)
#### 2.1 搜尋欄位範圍
- **workflows 表**: `name` + `description` 欄位
- **scratchpads 表**: 所有屬於匹配 workflows 的 `title` + `content` 欄位  
- **project_scope 過濾**: 可選的 project_scope 參數進行預過濾

#### 2.2 純英文搜尋
- 對 workflows 和 scratchpads 使用 FTS5 + OR logic 聯合搜尋
- 需要 JOIN 兩個表的 FTS5 索引

#### 2.3 含中文搜尋
- **步驟1**: 拆開英文與中文 keyword  
- **步驟2**: 每個關鍵詞單獨搜尋
  - 英文關鍵詞：使用 FTS5 + OR logic
  - 中文關鍵詞：分別用 jieba/simple 搜尋
- **步驟3**: 所有搜尋結果取聯集

### 3. 評分排序機制
- 對搜尋結果中每個 workflow 的 scratchpads 內容做單詞命中評分
- 評分越高排越前面

### 4. 分頁功能
- 預設輸出第一頁
- 每頁 5 項 (比現有的 20 項更少)

## 需要釐清的技術問題

### ✅ 問題1: Workflows 搜尋欄位範圍 (已確認)
**決策**: 
- `project_scope` 用作 filter 參數，不參與搜尋內容
- **搜尋欄位**: `workflows.name` + `workflows.description` + **該 workflow 下所有 scratchpads 的 title + content**
- 這意味著需要 JOIN workflows 和 scratchpads 表進行複合搜尋

### 🤔 問題2: 英文中文拆分邏輯
**現狀**: "拆開英文與中文 keyword" 的具體實作不明確
**技術問題**:
- 如何精確識別和分離中英文部分？
- 混合詞彙如 "React組件" 如何處理？
- 英文詞彙是否需要詞幹提取 (stemming)？

**範例場景**:
```
輸入: "React組件 用戶登入 authentication"
期望拆分結果: 
- 英文: ["React", "authentication"] 
- 中文: ["組件", "用戶", "登入"]
```

### ✅ 問題3: 中文搜尋邏輯 (已確認)
**決策**: 避開分詞器的固定 AND 邏輯限制
- **實作方式**: 每個關鍵詞單獨搜尋，再取聯集
- **範例**: `登入 認證` → 用 `登入` 做一次搜尋 + 用 `認證` 做一次搜尋 → 結果取聯集
- **原因**: simple/jieba 分詞器在多詞情況下固定用 AND 邏輯，會讓搜尋範圍太小

### 🤔 問題4: 聯集合併策略
**現狀**: 英文FTS5結果 + 中文jieba結果的合併方式不明確
**技術問題**:
- 如何去重？(根據 workflow.id)
- 如何處理同一個 workflow 在兩個搜尋中都命中？
- 初始排序順序？(按時間 vs 按相關性)

### ✅ 問題5: 評分機制詳細設計 (已確認採用權重計數)
**決策**: 採用權重計數法

**仍需釐清的技術細節**:
- **評分範圍**: 對搜尋結果中的所有 workflows 進行評分
- **詞彙來源**: 使用原始查詢詞 + jieba/simple 分詞結果
- **匹配範圍**: workflows.name + workflows.description + scratchpads.title + scratchpads.content
- **權重設計** (需確認):
  ```
  workflows.name 命中: 5 分/次
  workflows.description 命中: 3 分/次  
  scratchpads.title 命中: 3 分/次
  scratchpads.content 命中: 1 分/次
  ```
- **聚合方式**: 一個 workflow 的總分 = workflows 得分 + 所有 scratchpads 得分總和

**範例情境**:
```
查詢: "React 組件"
Workflow A: name="React專案", description="前端開發"
├─ Scratchpad 1: title="React基礎", content="組件設計模式..."
└─ Scratchpad 2: title="狀態管理", content="React hooks..."

權重計算:
- workflows.name中"React": 5分
- scratchpads[0].title中"React": 3分  
- scratchpads[0].content中"組件": 1分
- scratchpads[1].content中"React": 1分
總分: 5 + 3 + 1 + 1 = 10分
```

### 🤔 問題6: FTS5 索引架構調整
**新需求影響**: 由於搜尋範圍包含 workflows + scratchpads，需要重新設計索引策略
**選項**:
- Option A: 建立 `workflows_fts` 虛擬表 + 使用現有 `scratchpads_fts`，JOIN 查詢
- Option B: 創建統一的複合 FTS5 索引 (包含 workflows + scratchpads 資料)
- Option C: 分別搜尋兩個 FTS5 表，再合併結果

**建議**: Option A - 復用現有 scratchpads_fts，新增 workflows_fts

### 🤔 問題7: 分頁與效能
**現狀**: 每頁5項比現有的20項更少，但評分機制可能影響效能
**技術問題**:
- 評分是否需要在分頁前完成？(可能需要載入所有匹配的 workflows + scratchpads)
- 如何最佳化查詢效能？

## 建議實作策略

### 階段1: 基礎架構 (MVP)
1. 建立 `workflows_fts` 虛擬表
2. 實作純英文 FTS5 搜尋
3. 基本分頁功能 (無評分排序)

### 階段2: 中文支援
1. 實作英文中文拆分邏輯  
2. 整合 jieba 中文搜尋
3. 實作聯集合併

### 階段3: 評分系統
1. 實作 scratchpads 內容評分機制
2. 整合評分排序
3. 效能最佳化

## 相容性考量
- 復用現有的 jieba 分詞基礎設施
- 保持與現有錯誤處理機制一致
- 維持相同的降級策略 (FTS5 → LIKE)

---

## ✅ 最終技術決策 (全部確認)

### ✅ 問題A: 權重分配 (已確認)
```
workflows.name 命中: 5 分/次      (最高權重)
workflows.description 命中: 3 分/次  
scratchpads.title 命中: 3 分/次    (與 description 同權重)
scratchpads.content 命中: 1 分/次   (最低權重)
```

### ✅ 問題B: project_scope 過濾機制 (已確認)
- **需要** `project_scope` 參數 (可選)
- **完全匹配** 邏輯
- **無指定時搜尋所有** workflows

### ✅ 問題C: 查詢策略 (已確認)
**採用選項A**: 先搜尋 workflows，再載入其 scratchpads 進行評分
- 優勢：邏輯清晰，效能可控
- 流程：workflows 搜尋 → 載入匹配的 scratchpads → 權重評分 → 排序分頁

### ✅ 問題D: 英文中文拆分處理 (已確認)
**簡化策略**: 只拆分英文和中文，中文詞不再細分
- **範例**: "React組件開發" → `["React", "組件開發"]`
- **優勢**: 避免導入額外分詞工具，實作簡單
- **實作**: 用正則 `/[a-zA-Z]+/g` 提取英文，剩餘部分為中文

---

## 🚀 實作規劃 (MVP → 完整功能)

### 階段1: workflows_fts 基礎架構
1. 建立 `workflows_fts` 虛擬表
2. 實作基本 FTS5 搜尋 (workflows.name + description)
3. 加入 project_scope 完全匹配過濾

### 階段2: 複合搜尋與評分
1. 實作「先搜 workflows 再載 scratchpads」的查詢策略
2. 實作權重評分機制 (5/3/3/1 分配)
3. 英文中文簡化拆分邏輯

### 階段3: 整合與最佳化
1. 整合評分排序 (高分在前)
2. 實作分頁功能 (每頁 5 項)
3. 降級機制整合 (FTS5 → LIKE)

**✅ 所有技術問題已解決，可開始實作！**