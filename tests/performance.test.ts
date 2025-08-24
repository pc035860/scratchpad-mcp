/**
 * Performance Tests for Scratchpad MCP Server
 * 
 * Tests FTS5 search performance, large content handling,
 * and concurrent operations to ensure targets are met.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ScratchpadDatabase } from '../src/database/index.js';
import {
  createWorkflowTool,
  createScratchpadTool,
  searchScratchpadsTool,
  listScratchpadsTool,
} from '../src/tools/index.js';

/**
 * Performance test helper with metrics collection
 */
class PerformanceTestHelper {
  private db: ScratchpadDatabase;
  private createWorkflow: ReturnType<typeof createWorkflowTool>;
  private createScratchpad: ReturnType<typeof createScratchpadTool>;
  private searchScratchpads: ReturnType<typeof searchScratchpadsTool>;
  private listScratchpads: ReturnType<typeof listScratchpadsTool>;

  constructor(dbPath: string = ':memory:') {
    this.db = new ScratchpadDatabase({ filename: dbPath });
    this.createWorkflow = createWorkflowTool(this.db);
    this.createScratchpad = createScratchpadTool(this.db);
    this.searchScratchpads = searchScratchpadsTool(this.db);
    this.listScratchpads = listScratchpadsTool(this.db);
  }

  /**
   * Measure execution time of an async operation
   */
  async measureTime<T>(operation: () => Promise<T>, description: string): Promise<{ result: T; timeMs: number }> {
    const startTime = performance.now();
    const result = await operation();
    const endTime = performance.now();
    const timeMs = endTime - startTime;
    
    console.log(`⏱️  ${description}: ${timeMs.toFixed(2)}ms`);
    
    return { result, timeMs };
  }

  /**
   * Generate test content of specified size
   */
  generateContent(sizeKB: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 \n';
    const targetBytes = sizeKB * 1024;
    let content = '';
    
    while (content.length < targetBytes) {
      content += chars[Math.floor(Math.random() * chars.length)];
    }
    
    return content.substring(0, targetBytes);
  }

  /**
   * Generate realistic test data with common search terms
   */
  generateRealisticContent(index: number): { title: string; content: string } {
    const themes = [
      'JavaScript programming tutorial',
      'Python data science guide', 
      'React component development',
      'Node.js API documentation',
      'Database schema design',
      'Machine learning algorithms',
      'Web development best practices',
      'TypeScript type definitions',
      'Docker containerization',
      'Git version control'
    ];
    
    const keywords = [
      'function', 'class', 'import', 'export', 'const', 'let', 'var',
      'async', 'await', 'promise', 'callback', 'API', 'REST', 'JSON',
      'database', 'query', 'SELECT', 'INSERT', 'UPDATE', 'DELETE',
      'component', 'props', 'state', 'hook', 'render', 'DOM',
      'algorithm', 'data', 'structure', 'performance', 'optimization'
    ];
    
    const theme = themes[index % themes.length];
    const title = `${theme} - Part ${index + 1}`;
    
    // Generate content with searchable keywords
    let content = `# ${title}\n\n`;
    content += `This document covers ${theme.toLowerCase()} concepts and implementation details.\n\n`;
    
    // Add random keywords throughout
    for (let i = 0; i < 20; i++) {
      const keyword = keywords[Math.floor(Math.random() * keywords.length)];
      content += `The ${keyword} functionality is essential for modern development. `;
      content += `Understanding ${keyword} patterns helps improve code quality and maintainability.\n\n`;
    }
    
    // Add some code-like content
    content += '```javascript\n';
    content += `function example${index}() {\n`;
    content += `  const data = fetch('/api/${theme.replace(/\s+/g, '-')}');\n`;
    content += '  return data.json();\n';
    content += '}\n';
    content += '```\n\n';
    
    content += `For more information about ${theme.toLowerCase()}, refer to the official documentation.`;
    
    return { title, content };
  }

  /**
   * Create performance test dataset
   */
  async createTestDataset(workflowCount: number, scratchpadsPerWorkflow: number): Promise<{
    workflowIds: string[];
    scratchpadIds: string[];
    totalScratchpads: number;
  }> {
    const workflowIds: string[] = [];
    const scratchpadIds: string[] = [];

    console.log(`📊 Creating test dataset: ${workflowCount} workflows × ${scratchpadsPerWorkflow} scratchpads`);
    
    // Create workflows
    for (let w = 0; w < workflowCount; w++) {
      const workflowResult = await this.createWorkflow({
        name: `Performance Test Workflow ${w + 1}`,
        description: `Test workflow for performance testing - batch ${w + 1}`,
      });
      
      expect(workflowResult).toHaveProperty('workflow');
      workflowIds.push(workflowResult.workflow.id);
    }

    // Create scratchpads
    let scratchpadIndex = 0;
    for (const workflowId of workflowIds) {
      for (let s = 0; s < scratchpadsPerWorkflow; s++) {
        const { title, content } = this.generateRealisticContent(scratchpadIndex);
        
        const scratchpadResult = await this.createScratchpad({
          workflow_id: workflowId,
          title,
          content,
        });
        
        expect(scratchpadResult).toHaveProperty('scratchpad');
        scratchpadIds.push(scratchpadResult.scratchpad.id);
        scratchpadIndex++;
      }
    }

    const totalScratchpads = scratchpadIds.length;
    console.log(`✅ Dataset created: ${totalScratchpads} total scratchpads`);

    return { workflowIds, scratchpadIds, totalScratchpads };
  }

  /**
   * Test search performance with different query types
   */
  async testSearchPerformance(queryTerms: string[]): Promise<{
    avgTimeMs: number;
    maxTimeMs: number;
    results: { query: string; timeMs: number; resultCount: number }[];
  }> {
    const results = [];
    let totalTime = 0;
    let maxTime = 0;

    for (const query of queryTerms) {
      const { result, timeMs } = await this.measureTime(
        () => this.searchScratchpads({ query }),
        `Search: "${query}"`
      );
      
      expect(result).toHaveProperty('results');
      
      results.push({
        query,
        timeMs,
        resultCount: result.results.length,
      });
      
      totalTime += timeMs;
      maxTime = Math.max(maxTime, timeMs);
    }

    const avgTimeMs = totalTime / queryTerms.length;
    const maxTimeMs = maxTime; // Fix variable naming
    
    console.log(`📈 Search Performance Summary:`);
    console.log(`   Average: ${avgTimeMs.toFixed(2)}ms`);
    console.log(`   Maximum: ${maxTimeMs.toFixed(2)}ms`);
    console.log(`   Queries tested: ${queryTerms.length}`);

    return { avgTimeMs, maxTimeMs, results };
  }

  /**
   * Get database statistics
   */
  getStats() {
    return this.db.getStats();
  }

  close() {
    this.db.close();
  }
}

describe('Performance Tests', () => {
  let helper: PerformanceTestHelper;
  let testDataset: { workflowIds: string[]; scratchpadIds: string[]; totalScratchpads: number };

  // Use longer timeout for performance tests
  const PERFORMANCE_TIMEOUT = 60000; // 60 seconds

  beforeAll(async () => {
    helper = new PerformanceTestHelper();
    
    // Create substantial test dataset for realistic performance testing
    console.log('\n🚀 Setting up performance test environment...');
    testDataset = await helper.createTestDataset(5, 20); // 5 workflows × 20 scratchpads = 100 total
    
    const stats = helper.getStats();
    console.log(`📊 Database stats: hasFTS5=${stats.hasFTS5}, totalWorkflows=${stats.totalWorkflows}, totalScratchpads=${stats.totalScratchpads}`);
  }, PERFORMANCE_TIMEOUT);

  afterAll(() => {
    helper.close();
  });

  describe('FTS5 Search Performance', () => {
    it('should complete single-term searches in <100ms (95th percentile)', async () => {
      const singleTermQueries = [
        'function',
        'JavaScript', 
        'API',
        'database',
        'component',
        'algorithm',
        'performance',
        'development'
      ];

      const { avgTimeMs, maxTimeMs, results } = await helper.testSearchPerformance(singleTermQueries);

      // Calculate 95th percentile
      const sortedTimes = results.map(r => r.timeMs).sort((a, b) => a - b);
      const p95Index = Math.floor(sortedTimes.length * 0.95);
      const p95Time = sortedTimes[p95Index] || sortedTimes[sortedTimes.length - 1];

      console.log(`📊 Single-term search 95th percentile: ${p95Time.toFixed(2)}ms`);

      // Primary performance target
      expect(p95Time).toBeLessThan(100);
      
      // Secondary targets
      expect(avgTimeMs).toBeLessThan(50); // Average should be much faster
      expect(maxTimeMs).toBeLessThan(200); // No query should take longer than 200ms

      // Verify we're getting reasonable results
      const totalResults = results.reduce((sum, r) => sum + r.resultCount, 0);
      expect(totalResults).toBeGreaterThan(0);
      console.log(`✅ Total search results across all queries: ${totalResults}`);
    }, PERFORMANCE_TIMEOUT);

    it('should complete multi-term searches in <150ms (95th percentile)', async () => {
      const multiTermQueries = [
        'JavaScript function async',
        'React component state',
        'database query SELECT',
        'API REST JSON',
        'Python data science',
        'TypeScript type definitions',
        'Node.js server development',
        'machine learning algorithm'
      ];

      const { avgTimeMs, maxTimeMs, results } = await helper.testSearchPerformance(multiTermQueries);

      // Calculate 95th percentile for multi-term queries
      const sortedTimes = results.map(r => r.timeMs).sort((a, b) => a - b);
      const p95Index = Math.floor(sortedTimes.length * 0.95);
      const p95Time = sortedTimes[p95Index] || sortedTimes[sortedTimes.length - 1];

      console.log(`📊 Multi-term search 95th percentile: ${p95Time.toFixed(2)}ms`);

      // Relaxed target for multi-term searches
      expect(p95Time).toBeLessThan(150);
      expect(avgTimeMs).toBeLessThan(75);
      expect(maxTimeMs).toBeLessThan(300);

      // Verify search quality - more lenient for multi-term searches
      const hasResults = results.filter(r => r.resultCount > 0).length;
      expect(hasResults).toBeGreaterThanOrEqual(multiTermQueries.length * 0.25); // At least 25% should have results
      console.log(`🔍 Queries with results: ${hasResults}/${multiTermQueries.length}`);
    }, PERFORMANCE_TIMEOUT);

    it('should handle workflow-filtered searches efficiently', async () => {
      const workflowId = testDataset.workflowIds[0];
      const workflowQueries = [
        'function',
        'component',
        'database',
        'development'
      ];

      const results = [];
      for (const query of workflowQueries) {
        const { result, timeMs } = await helper.measureTime(
          () => helper.searchScratchpads({ query, workflow_id: workflowId }),
          `Workflow-filtered search: "${query}"`
        );
        
        expect(result).toHaveProperty('results');
        // All results should be from the specified workflow
        for (const searchResult of result.results) {
          expect(searchResult.workflow.id).toBe(workflowId);
        }
        
        results.push({ query, timeMs, resultCount: result.results.length });
      }

      const avgTime = results.reduce((sum, r) => sum + r.timeMs, 0) / results.length;
      console.log(`📊 Workflow-filtered search average: ${avgTime.toFixed(2)}ms`);
      
      // Filtered searches should be faster
      expect(avgTime).toBeLessThan(75);
    }, PERFORMANCE_TIMEOUT);
  });

  describe('Large Content Performance', () => {
    it('should handle 1MB scratchpads efficiently', async () => {
      // Create workflow for large content tests
      const workflowResult = await helper.createWorkflow({
        name: 'Large Content Test Workflow',
        description: 'Testing large scratchpad performance',
      });
      
      expect(workflowResult).toHaveProperty('workflow');
      const workflowId = workflowResult.workflow.id;

      // Test different sizes approaching 1MB limit
      const testSizes = [100, 250, 500, 750, 1000]; // KB
      const results = [];

      for (const sizeKB of testSizes) {
        const largeContent = helper.generateContent(sizeKB);
        
        const { result, timeMs } = await helper.measureTime(
          () => helper.createScratchpad({
            workflow_id: workflowId,
            title: `Large Content Test ${sizeKB}KB`,
            content: largeContent,
          }),
          `Create ${sizeKB}KB scratchpad`
        );
        
        expect(result).toHaveProperty('scratchpad');
        expect(result.scratchpad.size_bytes).toBe(sizeKB * 1024);
        
        results.push({ sizeKB, timeMs, scratchpadId: result.scratchpad.id });
      }

      // Verify creation time scales reasonably with size
      const maxCreationTime = Math.max(...results.map(r => r.timeMs));
      console.log(`📊 Largest scratchpad creation time: ${maxCreationTime.toFixed(2)}ms`);
      
      expect(maxCreationTime).toBeLessThan(1000); // Should create 1MB in under 1 second

      // Test searching in large content
      const largestScratchpadId = results[results.length - 1].scratchpadId;
      const { result: searchResult, timeMs: searchTime } = await helper.measureTime(
        () => helper.searchScratchpads({ query: 'content' }),
        'Search in large content'
      );
      
      console.log(`📊 Search with large content time: ${searchTime.toFixed(2)}ms`);
      expect(searchTime).toBeLessThan(200); // Should still be fast with large content
      expect(searchResult.results.length).toBeGreaterThan(0);
    }, PERFORMANCE_TIMEOUT);

    it('should handle concurrent operations on large datasets', async () => {
      const concurrentQueries = [
        'function',
        'component', 
        'database',
        'development',
        'algorithm'
      ];

      console.log(`🔄 Testing ${concurrentQueries.length} concurrent searches...`);
      
      const startTime = performance.now();
      
      // Execute all searches concurrently
      const promises = concurrentQueries.map(query => 
        helper.searchScratchpads({ query })
      );
      
      const results = await Promise.all(promises);
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      console.log(`⚡ Concurrent search completion time: ${totalTime.toFixed(2)}ms`);
      console.log(`📊 Average per query: ${(totalTime / concurrentQueries.length).toFixed(2)}ms`);
      
      // Concurrent execution should be efficient
      expect(totalTime).toBeLessThan(500); // All concurrent searches in under 500ms
      
      // All searches should succeed
      for (let i = 0; i < results.length; i++) {
        expect(results[i]).toHaveProperty('results');
        console.log(`   "${concurrentQueries[i]}": ${results[i].results.length} results`);
      }
    }, PERFORMANCE_TIMEOUT);
  });

  describe('Database Statistics and Health', () => {
    it('should report FTS5 availability and usage', async () => {
      const stats = helper.getStats();
      
      console.log(`📊 Database Health Report:`);
      console.log(`   FTS5 Available: ${stats.hasFTS5}`);
      console.log(`   Total Workflows: ${stats.totalWorkflows}`);
      console.log(`   Total Scratchpads: ${stats.totalScratchpads}`);
      
      expect(stats).toHaveProperty('hasFTS5');
      expect(stats).toHaveProperty('totalWorkflows');
      expect(stats).toHaveProperty('totalScratchpads');
      
      // Verify we have reasonable test data
      expect(stats.totalWorkflows).toBeGreaterThanOrEqual(5);
      expect(stats.totalScratchpads).toBeGreaterThanOrEqual(100);
      
      // Test a search to verify FTS5 or LIKE fallback is working
      const searchResult = await helper.searchScratchpads({ query: 'function' });
      expect(searchResult).toHaveProperty('search_method');
      expect(['fts5', 'like']).toContain(searchResult.search_method);
      
      console.log(`🔍 Search method in use: ${searchResult.search_method}`);
      
      if (stats.hasFTS5) {
        expect(searchResult.search_method).toBe('fts5');
        console.log('✅ FTS5 full-text search is active');
      } else {
        expect(searchResult.search_method).toBe('like');
        console.log('⚠️  Using LIKE fallback (FTS5 not available)');
      }
    });

    it('should demonstrate search performance comparison', async () => {
      const testQuery = 'JavaScript function';
      const iterations = 10;
      const times: number[] = [];

      console.log(`🏃‍♀️ Running ${iterations} iterations of search performance test...`);

      for (let i = 0; i < iterations; i++) {
        const { timeMs } = await helper.measureTime(
          () => helper.searchScratchpads({ query: testQuery }),
          `Iteration ${i + 1}`
        );
        times.push(timeMs);
      }

      // Calculate statistics
      const avgTime = times.reduce((sum, t) => sum + t, 0) / times.length;
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      const sortedTimes = [...times].sort((a, b) => a - b);
      const medianTime = sortedTimes[Math.floor(sortedTimes.length / 2)];
      const p95Time = sortedTimes[Math.floor(sortedTimes.length * 0.95)];

      console.log(`📊 Performance Statistics for "${testQuery}":`);
      console.log(`   Average: ${avgTime.toFixed(2)}ms`);
      console.log(`   Median:  ${medianTime.toFixed(2)}ms`);
      console.log(`   Min:     ${minTime.toFixed(2)}ms`);
      console.log(`   Max:     ${maxTime.toFixed(2)}ms`);
      console.log(`   95th %:  ${p95Time.toFixed(2)}ms`);

      // Performance assertions
      expect(avgTime).toBeLessThan(100);
      expect(p95Time).toBeLessThan(150);
      expect(maxTime).toBeLessThan(300);

      console.log('✅ All performance targets met');
    });
  });
});