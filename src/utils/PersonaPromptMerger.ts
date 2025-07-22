// Step4マージ機能 - PersonaPromptMergerクラス
// 作成日: 2025年7月22日
// 実装方式: 既存人格管理機能の補助ロジック（内部API）

import { PromptTokenManager } from '../utils/promptOptimization.js';
import { 
  MergeInputParams, 
  MergeResult, 
  PromptMergeHistory, 
  ConflictInfo, 
  MergeError,
  CompressionConfig,
  CapabilityInfo 
} from '../types/promptMerge.js';
import { PersonaCapabilities } from '../types/persona.js';

/**
 * システムプロンプトマージ機能のメインクラス
 * 既存人格管理システムの補助ロジックとして動作
 */
export class PersonaPromptMerger {
  private tokenManager: PromptTokenManager;
  private conflictDetector: ConflictDetector;
  private transactionManager: TransactionManager;
  private originalDataManager: OriginalDataManager;

  constructor() {
    this.tokenManager = new PromptTokenManager();
    this.conflictDetector = new ConflictDetector();
    this.transactionManager = new TransactionManager();
    this.originalDataManager = new OriginalDataManager();
  }

  /**
   * システムプロンプトマージ処理のメインエントリーポイント
   * @param params マージ処理パラメータ
   * @returns マージ結果またはエラー
   */
  async mergeSystemPrompt(params: MergeInputParams): Promise<MergeResult | MergeError> {
    const transactionId = await this.transactionManager.begin();
    
    try {
      // 1. 事前検証とバックアップ
      await this.preValidation(params);
      await this.originalDataManager.backup(params.contextId);

      // 2. 能力情報取得
      const capabilities = await this.getCapabilityInfo(params.contextId);

      // 3. 矛盾検出
      const conflicts = await this.conflictDetector.detect(
        params.userSystemPrompt, 
        capabilities, 
        params.taskContext
      );

      // 4. 矛盾がある場合の処理
      if (conflicts.length > 0 && !params.forceOverride) {
        return this.createConflictError(conflicts, transactionId);
      }

      // 5. マージ処理実行
      const mergeResult = await this.performMerge(params, capabilities);

      // 6. 結果保存とトランザクション完了
      await this.saveMergeHistory(params, mergeResult, transactionId);
      await this.transactionManager.commit(transactionId);

      return mergeResult;

    } catch (error) {
      // エラー時のロールバック
      await this.transactionManager.rollback(transactionId);
      return this.createMergeError(error, transactionId);
    }
  }

  /**
   * 事前検証処理
   */
  private async preValidation(params: MergeInputParams): Promise<void> {
    // 必須パラメータチェック
    if (!params.contextId || !params.userSystemPrompt) {
      throw new Error('Required parameters missing');
    }

    // Context存在チェック
    const contextExists = await this.checkContextExists(params.contextId);
    if (!contextExists) {
      throw new Error(`Context not found: ${params.contextId}`);
    }

    // ユーザープロンプトの基本検証
    const tokenCount = this.tokenManager.calculateTokens(params.userSystemPrompt);
    if (tokenCount > 10000) { // 上限チェック
      throw new Error('User prompt too long');
    }
  }

  /**
   * 能力情報取得
   */
  private async getCapabilityInfo(contextId: string): Promise<CapabilityInfo[]> {
    // TODO: Step3能力自覚システムとの連携実装
    // CapabilityAwarenessServiceから能力情報を取得
    console.log(`Getting capability info for context: ${contextId}`);
    return [];
  }

  /**
   * マージ処理実行
   */
  private async performMerge(
    params: MergeInputParams, 
    capabilities: CapabilityInfo[]
  ): Promise<MergeResult> {
    // TODO: AI要約技術によるマージ処理実装
    // 現在は基本的な文字列結合で骨格実装
    
    const originalTokenCount = this.tokenManager.calculateTokens(params.userSystemPrompt);
    const mergedPrompt = this.basicMerge(params.userSystemPrompt, capabilities, params.taskContext);
    const tokenCount = this.tokenManager.calculateTokens(mergedPrompt);

    return {
      mergedSystemPrompt: mergedPrompt,
      tokenCount,
      originalTokenCount,
      tokenReduction: originalTokenCount - tokenCount,
      sources: {
        userPrompt: 'summarized',
        capabilities: capabilities.map(c => c.name),
        taskContext: params.taskContext || 'none'
      },
      conflicts: [],
      compressionDetails: {
        compressionApplied: false,
        removedRedundancy: [],
        preservedInformation: ['user prompt', 'core capabilities']
      }
    };
  }

  /**
   * 基本的なマージ処理（骨格実装）
   */
  private basicMerge(
    userPrompt: string, 
    capabilities: CapabilityInfo[], 
    taskContext?: string
  ): string {
    let merged = userPrompt;

    // 能力情報の追加
    if (capabilities.length > 0) {
      const capabilitiesText = capabilities.map(c => `- ${c.name}: ${c.description}`).join('\n');
      merged += `\n\nYour capabilities include:\n${capabilitiesText}`;
    }

    // タスクコンテキストの追加
    if (taskContext) {
      merged += `\n\nCurrent task context: ${taskContext}`;
    }

    return merged;
  }

  /**
   * Context存在チェック
   */
  private async checkContextExists(contextId: string): Promise<boolean> {
    // TODO: ContextMemoryとの連携実装
    console.log(`Checking context exists: ${contextId}`);
    return true; // 骨格実装
  }

  /**
   * マージ履歴保存
   */
  private async saveMergeHistory(
    params: MergeInputParams, 
    result: MergeResult, 
    transactionId: string
  ): Promise<void> {
    // TODO: ContextMemoryでの永続保存実装
    console.log(`Saving merge history for transaction: ${transactionId}`);
  }

  /**
   * 矛盾エラー作成
   */
  private createConflictError(conflicts: ConflictInfo[], transactionId: string): MergeError {
    return {
      code: 'CONFLICT_DETECTED',
      message: 'System prompt merge failed due to conflicts',
      details: {
        conflictType: conflicts[0].type,
        conflictingItems: conflicts.flatMap(c => c.conflictingItems),
        suggestedFix: conflicts[0].suggestedResolution || 'Review and resolve conflicts',
        rollbackPerformed: true,
        previousState: 'restored'
      }
    };
  }

  /**
   * 一般的なマージエラー作成
   */
  private createMergeError(error: unknown, transactionId: string): MergeError {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return {
      code: 'MERGE_FAILED',
      message: `System prompt merge failed: ${errorMessage}`,
      details: {
        suggestedFix: 'Check input parameters and try again',
        rollbackPerformed: true,
        previousState: 'restored'
      }
    };
  }
}

/**
 * 矛盾検出クラス（骨格実装）
 */
class ConflictDetector {
  async detect(
    userPrompt: string, 
    capabilities: CapabilityInfo[], 
    taskContext?: string
  ): Promise<ConflictInfo[]> {
    // TODO: 詳細な矛盾検出ロジック実装
    console.log('Detecting conflicts...');
    return [];
  }
}

/**
 * トランザクション管理クラス（骨格実装）
 */
class TransactionManager {
  async begin(): Promise<string> {
    // TODO: 実際のトランザクション管理実装
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async commit(transactionId: string): Promise<void> {
    console.log(`Committing transaction: ${transactionId}`);
  }

  async rollback(transactionId: string): Promise<void> {
    console.log(`Rolling back transaction: ${transactionId}`);
  }
}

/**
 * オリジナルデータ管理クラス（骨格実装）
 */
class OriginalDataManager {
  async backup(contextId: string): Promise<void> {
    console.log(`Backing up original data for context: ${contextId}`);
  }
}
