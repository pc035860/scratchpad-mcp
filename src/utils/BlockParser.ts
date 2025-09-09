/**
 * BlockParser - 處理 scratchpad content 的 block 解析和操作
 *
 * 支援新舊兩種 append splitter 格式：
 * - 新格式：'\n\n---\n<!--- block start --->\n'
 * - 舊格式：'\n\n---\n'
 *
 * Block 定義：
 * - 第一個 block：從開始到第一個分隔符
 * - 其他 blocks：每個分隔符之後的內容直到下個分隔符
 * - 如果沒有分隔符，整個內容視為單一 block
 */

export interface BlockInfo {
  content: string;
  index: number;
  startPosition: number;
  endPosition: number;
  isFirstBlock: boolean;
}

export class BlockParser {
  // 新格式分隔符 (更明確的 block 標記)
  private static readonly NEW_SPLITTER = '\n\n---\n<!--- block start --->\n';

  // 舊格式分隔符 (向後兼容)
  private static readonly OLD_SPLITTER = '\n\n---\n';

  /**
   * 解析內容為多個 blocks
   *
   * @param content - scratchpad 內容
   * @returns BlockInfo 陣列，包含每個 block 的詳細資訊
   */
  static parseBlocks(content: string): BlockInfo[] {
    if (!content) {
      return [];
    }

    // 只有空白字符的內容仍算作單一 block
    if (content.trim() === '') {
      return [
        {
          content: content,
          index: 0,
          startPosition: 0,
          endPosition: content.length,
          isFirstBlock: true,
        },
      ];
    }

    const blocks: BlockInfo[] = [];

    // 尋找所有分隔符位置（優先新格式，然後舊格式）
    const newSplitterPositions = BlockParser.findAllSplitterPositions(
      content,
      BlockParser.NEW_SPLITTER
    );
    const oldSplitterPositions = BlockParser.findAllSplitterPositions(
      content,
      BlockParser.OLD_SPLITTER
    );

    // 合併並排序所有分隔符位置
    const allSplitters = [
      ...newSplitterPositions.map((pos) => ({ position: pos, splitter: BlockParser.NEW_SPLITTER })),
      ...oldSplitterPositions.map((pos) => ({ position: pos, splitter: BlockParser.OLD_SPLITTER })),
    ].sort((a, b) => a.position - b.position);

    // 移除重複的位置（當舊格式包含在新格式中時）
    const uniqueSplitters = BlockParser.removeDuplicatePositions(allSplitters);

    if (uniqueSplitters.length === 0) {
      // 沒有分隔符，整個內容是單一 block
      blocks.push({
        content: content,
        index: 0,
        startPosition: 0,
        endPosition: content.length,
        isFirstBlock: true,
      });
      return blocks;
    }

    // 第一個 block：從開始到第一個分隔符
    const firstSplitter = uniqueSplitters[0];
    blocks.push({
      content: content.substring(0, firstSplitter.position),
      index: 0,
      startPosition: 0,
      endPosition: firstSplitter.position,
      isFirstBlock: true,
    });

    // 中間的 blocks
    for (let i = 0; i < uniqueSplitters.length - 1; i++) {
      const currentSplitter = uniqueSplitters[i];
      const nextSplitter = uniqueSplitters[i + 1];
      const startPos = currentSplitter.position + currentSplitter.splitter.length;

      blocks.push({
        content: content.substring(startPos, nextSplitter.position),
        index: i + 1,
        startPosition: startPos,
        endPosition: nextSplitter.position,
        isFirstBlock: false,
      });
    }

    // 最後一個 block：從最後分隔符到結尾（包括空 block）
    const lastSplitter = uniqueSplitters[uniqueSplitters.length - 1];
    const lastStartPos = lastSplitter.position + lastSplitter.splitter.length;
    // 無論是否有內容都要建立最後一個 block（即使是空的）
    blocks.push({
      content: content.substring(lastStartPos),
      index: uniqueSplitters.length,
      startPosition: lastStartPos,
      endPosition: content.length,
      isFirstBlock: false,
    });

    return blocks;
  }

  /**
   * 取得指定數量的 blocks（從開始或結尾）
   *
   * @param content - scratchpad 內容
   * @param blockCount - 要取得的 block 數量
   * @param fromEnd - true: 從結尾取得, false: 從開始取得
   * @returns 合併後的內容字串
   */
  static getBlockRange(content: string, blockCount: number, fromEnd: boolean = true): string {
    if (blockCount <= 0) {
      return '';
    }

    const blocks = BlockParser.parseBlocks(content);

    if (blocks.length === 0) {
      return '';
    }

    if (blockCount >= blocks.length) {
      return content; // 要求的 block 數量超過總數，返回全部內容
    }

    let selectedBlocks: BlockInfo[];

    if (fromEnd) {
      // 從結尾取得 N 個 blocks
      selectedBlocks = blocks.slice(-blockCount);
    } else {
      // 從開始取得 N 個 blocks
      selectedBlocks = blocks.slice(0, blockCount);
    }

    // 重新組合選中的 blocks
    return BlockParser.reconstructBlocksToString(content, selectedBlocks);
  }

  /**
   * 刪除末尾指定數量的 blocks
   *
   * @param content - scratchpad 內容
   * @param blockCount - 要刪除的 block 數量
   * @returns 刪除後的內容字串
   */
  static chopBlocks(content: string, blockCount: number): string {
    if (blockCount <= 0) {
      return content;
    }

    const blocks = BlockParser.parseBlocks(content);

    if (blocks.length === 0) {
      return '';
    }

    if (blockCount >= blocks.length) {
      return ''; // 要刪除的數量超過總數，返回空內容
    }

    // 保留前面的 blocks
    const remainingBlocks = blocks.slice(0, blocks.length - blockCount);

    return BlockParser.reconstructBlocksToString(content, remainingBlocks);
  }

  /**
   * 取得 block 總數
   */
  static getBlockCount(content: string): number {
    return BlockParser.parseBlocks(content).length;
  }

  // === 私有輔助方法 ===

  /**
   * 尋找所有指定分隔符的位置
   */
  private static findAllSplitterPositions(content: string, splitter: string): number[] {
    const positions: number[] = [];
    let index = content.indexOf(splitter);

    while (index !== -1) {
      positions.push(index);
      index = content.indexOf(splitter, index + splitter.length);
    }

    return positions;
  }

  /**
   * 移除重複的分隔符位置（處理新舊格式重疊的情況）
   */
  private static removeDuplicatePositions(
    splitters: Array<{ position: number; splitter: string }>
  ): Array<{ position: number; splitter: string }> {
    const uniquePositions = new Map<number, { position: number; splitter: string }>();

    // 優先保留較長的分隔符（新格式）
    for (const splitter of splitters) {
      const existing = uniquePositions.get(splitter.position);
      if (!existing || splitter.splitter.length > existing.splitter.length) {
        uniquePositions.set(splitter.position, splitter);
      }
    }

    return Array.from(uniquePositions.values()).sort((a, b) => a.position - b.position);
  }

  /**
   * 將選中的 blocks 重新組合成字串
   */
  private static reconstructBlocksToString(originalContent: string, blocks: BlockInfo[]): string {
    if (blocks.length === 0) {
      return '';
    }

    if (blocks.length === 1) {
      return blocks[0].content;
    }

    // 分析原始內容中使用的分隔符類型
    let result = blocks[0].content;

    for (let i = 1; i < blocks.length; i++) {
      // 檢查原始內容中這兩個 block 之間使用的分隔符
      const prevBlock = blocks[i - 1];
      const currentBlock = blocks[i];

      const betweenContent = originalContent.substring(
        prevBlock.endPosition,
        currentBlock.startPosition
      );

      // 如果能找到原始分隔符，使用原始分隔符；否則使用新格式
      if (betweenContent.includes(BlockParser.NEW_SPLITTER)) {
        result += BlockParser.NEW_SPLITTER;
      } else if (betweenContent.includes(BlockParser.OLD_SPLITTER)) {
        result += BlockParser.OLD_SPLITTER;
      } else {
        // 預設使用新格式
        result += BlockParser.NEW_SPLITTER;
      }

      result += currentBlock.content;
    }

    return result;
  }
}
