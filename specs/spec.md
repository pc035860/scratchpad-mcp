# Scratchpad MCP Server - 簡化版設計規格

## 📋 背景與目標

### 核心問題
Claude Code 的 sub-agents 之間 context 不互通，導致無法有效進行多 agent 序列執行合作。

### 設計目標
- 提供同一工作流程內 sub-agents 的 context 共享空間
- 簡單直觀的工具設計，專注核心功能
- 支援 scratchpad 內容的創建、讀取、追加和搜尋

## 🏗️ 資料庫設計

### SQLite 表結構

```sql
-- 工作流表
CREATE TABLE workflows (
    id TEXT PRIMARY KEY,
    name TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT -- JSON string，可選
);

-- Scratchpad 表
CREATE TABLE scratchpads (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    name TEXT NOT NULL,
    content TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workflow_id) REFERENCES workflows(id)
);

-- 全文搜尋索引
CREATE VIRTUAL TABLE scratchpad_fts USING fts5(
    content, 
    scratchpad_id UNINDEXED,
    workflow_id UNINDEXED
);
```

## 🔧 MCP 工具設計

### 1. create-workflow
建立新的工作流程。

**參數:**
```typescript
interface CreateWorkflow {
  name?: string;
  metadata?: string; // JSON 字串
}
```

**回傳:**
```typescript
{
  workflow_id: string;
  created_at: string;
}
```

### 2. list-scratchpads
取得工作流程下的所有 scratchpad 清單。

**參數:**
```typescript
interface ListScratchpads {
  workflow_id: string;
  include_content?: boolean; // 預設 false，只返回 metadata
}
```

**回傳:**
```typescript
{
  scratchpads: Array<{
    id: string;
    name: string;
    created_at: string;
    updated_at: string;
    content?: string; // 當 include_content=true 時包含
  }>;
}
```

### 3. create-scratchpad
在指定工作流程下建立新的 scratchpad。

**參數:**
```typescript
interface CreateScratchpad {
  workflow_id: string;
  name: string;
  content: string;
}
```

**回傳:**
```typescript
{
  scratchpad_id: string;
  created_at: string;
}
```

### 4. get-scratchpad
取得指定 scratchpad 的完整內容。

**參數:**
```typescript
interface GetScratchpad {
  scratchpad_id: string;
  // 或批量取得
  scratchpad_ids?: string[];
}
```

**回傳:**
```typescript
{
  scratchpad: {
    id: string;
    name: string;
    workflow_id: string;
    content: string;
    created_at: string;
    updated_at: string;
  };
}
// 或批量回傳
{
  scratchpads: Array<...>;
}
```

### 5. append-scratchpad
在指定 scratchpad 末尾追加內容。

**參數:**
```typescript
interface AppendScratchpad {
  scratchpad_id: string;
  content: string;
  separator?: string; // 預設 "\n\n"
}
```

**回傳:**
```typescript
{
  updated_at: string;
  new_length: number;
}
```

### 6. search-scratchpads
搜尋 scratchpad 內容。

**參數:**
```typescript
interface SearchScratchpads {
  workflow_id?: string; // 不提供則全域搜尋
  query: string;
  limit?: number; // 預設 20
  include_content?: boolean; // 預設 true，包含高亮片段
}
```

**回傳:**
```typescript
{
  results: Array<{
    scratchpad_id: string;
    name: string;
    workflow_id: string;
    snippet: string; // 包含搜尋關鍵字的內容片段
  }>;
}
```

## ⚙️ 配置與限制

```yaml
# 基本限制
max_scratchpad_size: 1MB
max_scratchpads_per_workflow: 50
search_result_limit: 20
auto_cleanup_days: 7

# 錯誤處理
error_handling:
  invalid_workflow_id: "return empty result"
  scratchpad_not_found: "return null"
  content_too_large: "truncate and warn"
```

## 🚀 實現計劃

### 開發階段（3天完成）

**Day 1: 基礎架構**
- SQLite 資料庫設定和表結構
- MCP server 基本框架
- 基本的錯誤處理

**Day 2: 核心工具**
- create-workflow
- create-scratchpad  
- get-scratchpad
- append-scratchpad

**Day 3: 搜尋和整合**
- list-scratchpads
- search-scratchpads
- FTS5 全文搜尋索引
- 基本測試和文檔

## 📝 使用範例

```typescript
// 1. 建立工作流程
const workflow = await createWorkflow({ 
  name: "Code Refactoring Task" 
});

// 2. Agent A 分析代碼並記錄
await createScratchpad({
  workflow_id: workflow.workflow_id,
  name: "code_analysis",
  content: "發現 3 個主要問題:\n1. UserService 效能瓶頸...\n2. 記憶體洩漏..."
});

// 3. Agent B 讀取分析結果
const analysis = await getScratchpad({ 
  scratchpad_id: "code_analysis_id" 
});

// 4. Agent B 補充解決方案
await appendScratchpad({
  scratchpad_id: "code_analysis_id",
  content: "\n\n建議解決方案:\n1. 加入快取層...\n2. 實作物件池..."
});

// 5. Agent C 搜尋相關資訊
const results = await searchScratchpads({
  workflow_id: workflow.workflow_id,
  query: "快取 效能",
  limit: 10
});

// 6. 列出所有 scratchpads
const allScratchpads = await listScratchpads({
  workflow_id: workflow.workflow_id,
  include_content: false
});
```

## 🎯 技術規格

### 核心技術棧
- **語言**: TypeScript (strict mode)
- **運行環境**: Node.js 18+
- **資料庫**: SQLite + better-sqlite3
- **全文搜尋**: FTS5 (SQLite 內建)
- **MCP 框架**: @modelcontextprotocol/sdk
- **協議**: MCP (Model Context Protocol)

### 開發工具鏈
- **建置工具**: tsup (快速、零配置)
- **測試框架**: Vitest (與 Vite 生態整合)
- **程式碼品質**: ESLint + Prettier
- **型別檢查**: tsc --noEmit

### 依賴套件
```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "better-sqlite3": "^9.0.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.8",
    "tsup": "^8.0.0",
    "vitest": "^1.0.0",
    "typescript": "^5.3.0",
    "eslint": "^8.0.0",
    "prettier": "^3.0.0"
  }
}
```

### 建置腳本
```json
{
  "scripts": {
    "dev": "tsup --watch",
    "build": "tsup",
    "test": "vitest",
    "test:watch": "vitest --watch",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src --ext .ts",
    "lint:fix": "eslint src --ext .ts --fix"
  }
}
```

### 專案結構
```
scratchpad-mcp/
├── src/
│   ├── server.ts           # MCP server 入口
│   ├── database/
│   │   ├── schema.ts       # SQL schema 定義
│   │   └── client.ts       # SQLite 連接管理
│   ├── tools/              # MCP 工具實作
│   │   ├── workflow.ts     # 工作流工具
│   │   ├── scratchpad.ts   # Scratchpad 工具
│   │   └── search.ts       # 搜尋工具
│   ├── types.ts            # TypeScript 型別定義
│   └── utils.ts            # 通用函數
├── tests/                  # 測試檔案
├── dist/                   # 建置輸出
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── eslint.config.js
└── README.md
```

### 配置檔案

**tsconfig.json**:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**tsup.config.ts**:
```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  minify: false,
  sourcemap: true
});
```

### 技術選擇理由
- **TypeScript strict mode**: 基於 mcp-duckdb-memory-server 成功經驗，型別安全減少執行時錯誤
- **better-sqlite3**: 同步 API 程式碼簡潔，FTS5 支援完整，效能優秀
- **tsup**: 零配置建置工具，支援 ESM/CJS 雙模式，建置速度快
- **Vitest**: 比 Jest 快，內建 TypeScript 支援，in-memory SQLite 測試友好
- **單檔案部署**: 建置後可產生單一執行檔，部署簡單