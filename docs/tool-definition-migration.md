# MCP TypeScript SDK Tool Definition Migration Guide

本文檔說明如何將 MCP TypeScript SDK 中的工具（Tool）定義從舊寫法遷移至新版寫法。

---

## 目錄
- [背景說明](#背景說明)
- [舊寫法範例](#舊寫法範例)
- [新寫法範例](#新寫法範例)
- [遷移步驟說明](#遷移步驟說明)
- [對比表格](#對比表格)
- [參考資源](#參考資源)

---

## 背景說明

MCP TypeScript SDK 近期針對工具定義新增了結構化與型別驗證機制，由舊版以程式碼自由度高但型別不嚴謹的 `tool()` 方法，轉換成使用 `registerTool()` 並搭配 `zod` schema 來做參數驗證與描述的新寫法，以提升開發體驗與執行安全。

---

## 舊寫法範例

```
server.tool("my_tool", "工具描述", {
  title: "工具標題"
}, async (args) => {
  // args 為任意物件，需自行驗證
  // 工具邏輯
  return { result: "執行結果" };
});
```

- 使用 `tool()` 方法
- 標題可能放在 annotations 內的 `title`
- 無內建輸入驗證
- 回傳結構不固定

---

## 新寫法範例

```
import { z } from "zod";

server.registerTool("my_tool", {
  title: "工具標題",
  description: "工具描述",
  inputSchema: {
    param1: z.string(),
    param2: z.number(),
  }
}, async ({ param1, param2 }) => {
  // 參數已經被驗證且有型別
  return {
    content: [
      { type: "text", text: `參數1: ${param1}, 參數2: ${param2}` }
    ]
  };
});
```

- 使用 `registerTool()` 且帶入結構化物件
- 明確用 `title` 欄位定義工具標題
- 支援用 `zod` schema 做強型別與驗證
- 回傳符合 MCP 標準格式的結果內容

---

## 遷移步驟說明

1. 將原本 `tool()` 改成 `registerTool()`。
2. 將工具名稱、描述及原本的 annotations 改成統一放入物件參數中。
3. 用 `zod` 建立 `inputSchema`，定義參數類型與驗證規則。
4. 修改 handler 函式，接收經驗證的解構參數。
5. 更新回傳內容，符合 MCP 格式，如 `content` 陣列。
6. 移除舊寫法中使用的 annotations.title，改用 `title`。

---

## 對比表格

| 項目       | 舊寫法（tool）                             | 新寫法（registerTool）                                |
|------------|----------------------------------------|---------------------------------------------------|
| 定義方法    | `tool(name, desc, annotations, handler)` | `registerTool(name, {title, description, inputSchema}, handler)` |
| 標題來源    | annotations.title                       | 直接用 `title` 欄位                                    |
| 輸入參數驗證 | 無，需自訂                             | 使用 `zod` schema，自動驗證與強型別                      |
| 回傳結果    | 形式不固定                             | 標準 MCP 格式，如 `{ content: [...] }`                |
| 可讀性/維護性 | 較低                                   | 較高，結構化且型別明確                                  |
| 官方推薦    | 兼容                                   | 推薦使用                                              |

---

## 參考資源

- [MCP TypeScript SDK 官方 GitHub](https://github.com/modelcontextprotocol/typescript-sdk)
- MCP SDK README 範例與文件說明