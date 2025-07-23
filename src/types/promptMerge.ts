// Step4マージ機能 - TypeScript型定義
// 作成日: 2025年7月22日

import { Tool } from './tool.js'; // Tool型をインポート

/**
 * マージ処理の設定
 */
export interface CompressionConfig {
  level: 'light' | 'medium' | 'heavy';
  preserveSecurityConstraints: boolean;
  maxTokens?: number;
  compressionStrategy: 'ai_summary' | 'template_based' | 'hybrid';
}

/**
 * マージ処理結果
 */
export interface MergeResult {
  mergedSystemPrompt: string;
  tokenCount: number;
  originalTokenCount: number;
  tokenReduction: number;
  sources: {
    userPrompt: string;
    capabilities: string[];
    taskContext: string;
  };
  conflicts: ConflictInfo[];
  compressionDetails: {
    compressionApplied: boolean;
    removedRedundancy: string[];
    preservedInformation: string[];
  };
}

/**
 * 矛盾情報
 */
export interface ConflictInfo {
  type: 'capability_conflict' | 'constraint_contradiction' | 'language_mismatch';
  severity: 'warning' | 'error' | 'critical';
  description: string;
  conflictingItems: string[];
  suggestedResolution?: string;
}

/**
 * プロンプトマージ履歴（DB保存用）
 */
export interface PromptMergeHistory {
  id: string;
  contextId: string;
  timestamp: Date;
  originalUserPrompt: string;           // 完全なオリジナル
  originalCapabilities: CapabilityInfo[]; // 詳細能力情報
  originalTaskContext: string;         // 元タスクコンテキスト
  mergedResult: MergeResult;           // LLM出力結果
  compressionSettings: CompressionConfig;
  version: number;
  status: 'pending' | 'success' | 'failed' | 'rolled_back'; // 処理状態
  errorInfo?: ErrorDetails;            // エラー情報（失敗時）
  rollbackInfo?: RollbackDetails;      // ロールバック情報
}

/**
 * エラー管理
 */
export interface ErrorDetails {
  errorType: 'conflict' | 'compression_failed' | 'token_overflow' | 'validation_error';
  message: string;
  details: Record<string, string | number | boolean | string[]>;
  suggestedFix?: string;
  timestamp: Date;
}

/**
 * ロールバック管理
 */
export interface RollbackDetails {
  previousVersion: number;
  rollbackReason: string;
  rollbackTimestamp: Date;
  rollbackSuccess: boolean;
}

/**
 * 能力情報（詳細版）
 */
export interface CapabilityInfo {
  id: string;
  name: string;
  description: string;
  constraints: string[];
  relatedTools: string[];
  priority: 'high' | 'medium' | 'low';
}

/**
 * マージエラー（MCPツール応答用）
 */
export interface MergeError {
  code: 'MERGE_FAILED' | 'VALIDATION_ERROR' | 'CONFLICT_DETECTED' | 'TOKEN_OVERFLOW';
  message: string;
  details: {
    conflictType?: string;
    conflictingItems?: string[];
    suggestedFix?: string;
    rollbackPerformed: boolean;
    previousState: string;
  };
}

/**
 * マージ処理の入力パラメータ
 */
export interface MergeInputParams {
  contextId: string;
  userSystemPrompt: string;
  taskContext?: string;
  availableTools?: Tool[]; // ツール定義を追加
  compressionConfig?: CompressionConfig;
  forceOverride?: boolean; // 矛盾があっても強制実行
}
