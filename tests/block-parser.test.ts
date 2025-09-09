/**
 * BlockParser Class Unit Tests
 * 
 * Comprehensive tests for the BlockParser utility class,
 * covering all block parsing operations including new/old format compatibility,
 * boundary conditions, and edge cases.
 */
import { describe, it, expect } from 'vitest';
import { BlockParser } from '../src/utils/BlockParser.js';

describe('BlockParser Unit Tests', () => {
  describe('parseBlocks - Format Detection', () => {
    it('should parse empty content', () => {
      expect(BlockParser.parseBlocks('')).toEqual([]);
      // 空白字符內容應該被視為單一 block
      const whitespaceResult = BlockParser.parseBlocks('   ');
      expect(whitespaceResult).toHaveLength(1);
      expect(whitespaceResult[0].content).toBe('   ');
    });

    it('should parse single block with no splitter', () => {
      const content = 'Single block content\nWith multiple lines\nBut no splitter';
      const blocks = BlockParser.parseBlocks(content);
      
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toEqual({
        content: content,
        index: 0,
        startPosition: 0,
        endPosition: content.length,
        isFirstBlock: true
      });
    });

    it('should parse content with new format splitter', () => {
      const content = 'First block\n\n---\n<!--- block start --->\nSecond block\n\n---\n<!--- block start --->\nThird block';
      const blocks = BlockParser.parseBlocks(content);
      
      expect(blocks).toHaveLength(3);
      expect(blocks[0].content).toBe('First block');
      expect(blocks[0].isFirstBlock).toBe(true);
      expect(blocks[1].content).toBe('Second block');
      expect(blocks[1].isFirstBlock).toBe(false);
      expect(blocks[2].content).toBe('Third block');
      expect(blocks[2].isFirstBlock).toBe(false);
    });

    it('should parse content with old format splitter', () => {
      const content = 'First block\n\n---\nSecond block\n\n---\nThird block';
      const blocks = BlockParser.parseBlocks(content);
      
      expect(blocks).toHaveLength(3);
      expect(blocks[0].content).toBe('First block');
      expect(blocks[1].content).toBe('Second block');
      expect(blocks[2].content).toBe('Third block');
    });

    it('should handle mixed new and old format splitters', () => {
      const content = 'First block\n\n---\nSecond block\n\n---\n<!--- block start --->\nThird block';
      const blocks = BlockParser.parseBlocks(content);
      
      expect(blocks).toHaveLength(3);
      expect(blocks[0].content).toBe('First block');
      expect(blocks[1].content).toBe('Second block');
      expect(blocks[2].content).toBe('Third block');
    });

    it('should prioritize new format over old format when overlapping', () => {
      // This tests the removeDuplicatePositions logic
      const content = 'First\n\n---\n<!--- block start --->\nSecond';
      const blocks = BlockParser.parseBlocks(content);
      
      expect(blocks).toHaveLength(2);
      expect(blocks[0].content).toBe('First');
      expect(blocks[1].content).toBe('Second');
    });
  });

  describe('parseBlocks - Position Tracking', () => {
    it('should correctly track block positions', () => {
      const content = 'Block1\n\n---\nBlock2\n\n---\nBlock3';
      const blocks = BlockParser.parseBlocks(content);
      
      expect(blocks[0].startPosition).toBe(0);
      expect(blocks[0].endPosition).toBe(6); // 'Block1'.length
      expect(blocks[1].startPosition).toBe(12); // After '\n\n---\n' (splitter length 6)
      expect(blocks[1].endPosition).toBe(18); // 'Block2'.length + start
      expect(blocks[2].startPosition).toBe(24); // After second splitter
    });

    it('should handle blocks with empty content', () => {
      const content = '\n\n---\n\n\n---\nFinal block';
      const blocks = BlockParser.parseBlocks(content);
      
      expect(blocks).toHaveLength(3);
      expect(blocks[0].content).toBe('');
      expect(blocks[1].content).toBe('');
      expect(blocks[2].content).toBe('Final block');
    });
  });

  describe('getBlockRange - Basic Operations', () => {
    const sampleContent = 'Block1\n\n---\nBlock2\n\n---\nBlock3\n\n---\nBlock4';

    it('should get specified blocks from end (fromEnd=true)', () => {
      const result = BlockParser.getBlockRange(sampleContent, 2, true);
      expect(result).toContain('Block3');
      expect(result).toContain('Block4');
      expect(result).not.toContain('Block1');
      expect(result).not.toContain('Block2');
    });

    it('should get specified blocks from start (fromEnd=false)', () => {
      const result = BlockParser.getBlockRange(sampleContent, 2, false);
      expect(result).toContain('Block1');
      expect(result).toContain('Block2');
      expect(result).not.toContain('Block3');
      expect(result).not.toContain('Block4');
    });

    it('should return all content when requesting more blocks than available', () => {
      const result = BlockParser.getBlockRange(sampleContent, 10, true);
      expect(result).toBe(sampleContent);
    });

    it('should return empty string when requesting 0 blocks', () => {
      const result = BlockParser.getBlockRange(sampleContent, 0, true);
      expect(result).toBe('');
    });

    it('should handle negative block count gracefully', () => {
      const result = BlockParser.getBlockRange(sampleContent, -1, true);
      expect(result).toBe('');
    });

    it('should preserve original splitter format in reconstruction', () => {
      const newFormatContent = 'Block1\n\n---\n<!--- block start --->\nBlock2';
      const result = BlockParser.getBlockRange(newFormatContent, 2, true);
      expect(result).toContain('<!--- block start --->');
      
      const oldFormatContent = 'Block1\n\n---\nBlock2';
      const result2 = BlockParser.getBlockRange(oldFormatContent, 2, true);
      expect(result2).not.toContain('<!--- block start --->');
      expect(result2).toContain('---');
    });
  });

  describe('chopBlocks - Block Removal', () => {
    const sampleContent = 'Block1\n\n---\nBlock2\n\n---\nBlock3\n\n---\nBlock4';

    it('should remove specified number of blocks from end', () => {
      const result = BlockParser.chopBlocks(sampleContent, 1);
      expect(result).toContain('Block1');
      expect(result).toContain('Block2');
      expect(result).toContain('Block3');
      expect(result).not.toContain('Block4');
    });

    it('should remove multiple blocks from end', () => {
      const result = BlockParser.chopBlocks(sampleContent, 2);
      expect(result).toContain('Block1');
      expect(result).toContain('Block2');
      expect(result).not.toContain('Block3');
      expect(result).not.toContain('Block4');
    });

    it('should return empty string when chopping all blocks', () => {
      const result = BlockParser.chopBlocks(sampleContent, 4);
      expect(result).toBe('');
    });

    it('should return empty string when chopping more blocks than available', () => {
      const result = BlockParser.chopBlocks(sampleContent, 10);
      expect(result).toBe('');
    });

    it('should return original content when chopping 0 blocks', () => {
      const result = BlockParser.chopBlocks(sampleContent, 0);
      expect(result).toBe(sampleContent);
    });

    it('should handle single block content', () => {
      const singleBlock = 'Only one block';
      const result = BlockParser.chopBlocks(singleBlock, 1);
      expect(result).toBe('');
    });
  });

  describe('getBlockCount - Block Counting', () => {
    it('should count blocks correctly with no splitters', () => {
      const content = 'Single block';
      expect(BlockParser.getBlockCount(content)).toBe(1);
    });

    it('should count blocks correctly with splitters', () => {
      const content = 'Block1\n\n---\nBlock2\n\n---\nBlock3';
      expect(BlockParser.getBlockCount(content)).toBe(3);
    });

    it('should count blocks correctly with mixed splitter formats', () => {
      const content = 'Block1\n\n---\nBlock2\n\n---\n<!--- block start --->\nBlock3';
      expect(BlockParser.getBlockCount(content)).toBe(3);
    });

    it('should return 0 for empty content', () => {
      expect(BlockParser.getBlockCount('')).toBe(0);
      expect(BlockParser.getBlockCount('   ')).toBe(1); // Whitespace still counts as content
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle content ending with splitter', () => {
      const content = 'Block1\n\n---\nBlock2\n\n---\n<!--- block start --->\n';
      const blocks = BlockParser.parseBlocks(content);
      
      expect(blocks).toHaveLength(3);
      expect(blocks[2].content).toBe(''); // Last block is empty
    });

    it('should handle content starting with splitter', () => {
      const content = '\n\n---\nBlock1\n\n---\nBlock2';
      const blocks = BlockParser.parseBlocks(content);
      
      expect(blocks).toHaveLength(3);
      expect(blocks[0].content).toBe(''); // First block is empty
      expect(blocks[1].content).toBe('Block1');
      expect(blocks[2].content).toBe('Block2');
    });

    it('should handle consecutive splitters', () => {
      const content = 'Block1\n\n---\n\n\n---\nBlock3';
      const blocks = BlockParser.parseBlocks(content);
      
      expect(blocks).toHaveLength(3);
      expect(blocks[0].content).toBe('Block1');
      expect(blocks[1].content).toBe(''); // Middle block is empty
      expect(blocks[2].content).toBe('Block3');
    });

    it('should handle UTF-8 content with special characters', () => {
      const content = '中文內容\n\n---\n<!--- block start --->\n🚀 Emoji block\n\n---\nFinal block';
      const blocks = BlockParser.parseBlocks(content);
      
      expect(blocks).toHaveLength(3);
      expect(blocks[0].content).toBe('中文內容');
      expect(blocks[1].content).toBe('🚀 Emoji block');
      expect(blocks[2].content).toBe('Final block');
    });

    it('should handle very large content efficiently', () => {
      // Generate large content with multiple blocks
      const blockSize = 1000;
      const numBlocks = 50;
      let largeContent = '';
      
      for (let i = 0; i < numBlocks; i++) {
        if (i > 0) largeContent += '\n\n---\n<!--- block start --->\n';
        largeContent += `Block ${i + 1} `.repeat(blockSize);
      }
      
      const startTime = Date.now();
      const blocks = BlockParser.parseBlocks(largeContent);
      const endTime = Date.now();
      
      expect(blocks).toHaveLength(numBlocks);
      expect(endTime - startTime).toBeLessThan(100); // Should parse quickly
    });

    it('should handle malformed splitters gracefully', () => {
      const content = 'Block1\n\n--\nNot a splitter\n\n---\nBlock2';
      const blocks = BlockParser.parseBlocks(content);
      
      expect(blocks).toHaveLength(2); // Only valid splitter should be recognized
      expect(blocks[0].content).toBe('Block1\n\n--\nNot a splitter');
      expect(blocks[1].content).toBe('Block2');
    });
  });

  describe('Reconstruction Consistency', () => {
    it('should maintain content consistency through parse->reconstruct cycle', () => {
      const originalContent = 'Block1\n\n---\n<!--- block start --->\nBlock2\n\n---\nBlock3';
      const blocks = BlockParser.parseBlocks(originalContent);
      
      // Get all blocks (should reconstruct to original)
      const reconstructed = BlockParser.getBlockRange(originalContent, blocks.length, false);
      
      expect(reconstructed).toBe(originalContent);
    });

    it('should preserve splitter format consistency in partial reconstructions', () => {
      // 測試案例1：前兩個 block 用舊格式分隔
      const mixedContent1 = 'B1\n\n---\nB2\n\n---\n<!--- block start --->\nB3\n\n---\nB4';
      const partial1 = BlockParser.getBlockRange(mixedContent1, 2, false);
      expect(partial1).toContain('B1');
      expect(partial1).toContain('B2');
      expect(partial1).not.toContain('<!--- block start --->'); // 應該使用舊格式
      
      // 測試案例2：最後兩個 block 其中包含新格式分隔
      const mixedContent2 = 'B1\n\n---\nB2\n\n---\n<!--- block start --->\nB3\n\n---\n<!--- block start --->\nB4';
      const partial2 = BlockParser.getBlockRange(mixedContent2, 2, true);
      expect(partial2).toContain('B3');
      expect(partial2).toContain('B4');
      expect(partial2).toContain('<!--- block start --->'); // 應該保留新格式
    });
  });
});