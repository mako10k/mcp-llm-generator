// Step4マージ機能 - メインAPIエクスポート
// 作成日: 2025年7月22日
// 目的: LLMベース統合対応Step4機能の公開API

export { PersonaPromptMerger } from './utils/PersonaPromptMerger.js';
export { ConflictDetector } from './utils/ConflictDetector.js';
export { TransactionManager } from './utils/TransactionManager.js';
export { OriginalDataManager } from './utils/OriginalDataManager.js';
export { PromptMergeDatabase } from './utils/PromptMergeDatabase.js';

// 型定義のエクスポート
export {
  MergeInputParams,
  MergeResult,
  ConflictInfo,
  MergeError,
  CapabilityInfo,
  PromptMergeHistory,
  CompressionConfig,
  ErrorDetails,
  RollbackDetails
} from './types/promptMerge.js';

// LLM統合結果の型定義
export type { LLMConflictDetectionResult } from './utils/ConflictDetector.js';

/**
 * Step4マージ機能の使用例
 * 
 * ```typescript
 * import { PersonaPromptMerger } from './step4-merge-api.js';
 * import Database from 'better-sqlite3';
 * 
 * const db = new Database('path/to/database.db');
 * const merger = new PersonaPromptMerger(db);
 * 
 * const result = await merger.mergeSystemPrompt({
 *   contextId: 'example-context',
 *   userSystemPrompt: 'You are a helpful assistant...',
 *   capabilities: [
 *     { name: 'web_search', description: 'Search the web', priority: 1 }
 *   ],
 *   taskContext: 'Help with research',
 *   compressionConfig: { targetTokens: 2000, prioritizeRecent: true }
 * });
 * 
 * if (result.success) {
 *   console.log('Merged prompt:', result.mergedSystemPrompt);
 * } else {
 *   console.log('Conflicts detected:', result.conflicts);
 * }
 * ```
 */
