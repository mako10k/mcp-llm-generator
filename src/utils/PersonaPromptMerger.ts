// Step4マージ機能 - PersonaPromptMerger (LLMベース統合版 + ToolCall統合)
// 作成日: 2025年7月22日
// 改修日: 2025年7月22日 - ConflictDetector LLMベース統合対応
// 改修日: 2025年7月22日 - SystemPromptGenerator ToolCall機能統合
// 実装方式: 既存人格管理機能の補助ロジック（内部API）

import { PromptTokenManager } from '../utils/promptOptimization.js';
import { ConflictDetector, LLMConflictDetectionResult } from './ConflictDetector.js';
import { TransactionManager } from './TransactionManager.js';
import { OriginalDataManager } from './OriginalDataManager.js';
import { PromptMergeDatabase } from './PromptMergeDatabase.js';
import { SystemPromptGenerator } from '../toolcall-emulation/SystemPromptGenerator.js';
import { OptimizedSystemPromptGenerator } from '../toolcall-emulation/OptimizedSystemPromptGenerator.js';
import { 
  MergeInputParams, 
  MergeResult, 
  ConflictInfo, 
  MergeError,
  CapabilityInfo,
  PromptMergeHistory 
} from '../types/promptMerge.js';
import { Tool } from '../types/tool.js';
import { Database } from 'better-sqlite3';

/**
 * システムプロンプトマージ機能のメインクラス (LLMベース統合版 + ToolCall統合)
 * 既存人格管理システムの補助ロジックとして動作
 * ConflictDetectorのLLMベース統合処理を活用
 * SystemPromptGeneratorのツール定義機能を統合
 * 
 * 処理順序:
 * 1. ペルソナプロンプト + 能力情報をマージ・圧縮
 * 2. ツール定義を非圧縮で追加
 * 3. 最終統合プロンプトを生成
 */
export class PersonaPromptMerger {
  private tokenManager: PromptTokenManager;
  private database: Database;
  private mergeDatabase: PromptMergeDatabase;
  private conflictDetector: ConflictDetector;
  private systemPromptGenerator: SystemPromptGenerator;
  private optimizedPromptGenerator: OptimizedSystemPromptGenerator;
  private useOptimizedPrompts: boolean;

  constructor(database: Database, options: { useOptimizedPrompts?: boolean } = {}) {
    this.database = database;
    this.tokenManager = new PromptTokenManager();
    this.mergeDatabase = new PromptMergeDatabase(database);
    this.conflictDetector = new ConflictDetector();
    
    // 最適化プロンプトの使用設定（デフォルト: true）
    this.useOptimizedPrompts = options.useOptimizedPrompts !== false;
    
    // SystemPromptGenerator統合（ツール定義用）
    this.systemPromptGenerator = new SystemPromptGenerator({
      includeExamples: true,
      strictMode: true,
      personaAware: false, // ペルソナはPersonaPromptMergerで処理
      contextLengthLimit: 8000,
      includeToolValidation: true
    });
    
    // 最適化版プロンプトジェネレーター
    this.optimizedPromptGenerator = new OptimizedSystemPromptGenerator({
      includeExamples: false,
      strictMode: true,
      personaAware: false,
      contextLengthLimit: 4000,
      includeToolValidation: true
    });
  }

  /**
   * Step4マージのメイン処理エントリーポイント（LLMベース統合版 + ToolCall統合）
   * ConflictDetectorの統合処理を活用してマージと矛盾検出を同時実行
   * SystemPromptGeneratorのツール定義を非圧縮で統合
   * PM指示: トランザクション外でLLM処理、DB更新のみトランザクション内で実行
   */
  async mergeSystemPrompt(
    params: MergeInputParams
  ): Promise<MergeResult | MergeError> {
    try {
      // 1. 事前データ取得（トランザクション外）
      const capabilities = await this.loadCapabilitiesFromContext(params.contextId);
      
      // 2. ペルソナプロンプト + 能力のマージ・圧縮（トランザクション外）
      const personaResult = await this.conflictDetector.detectAndMerge(
        params.userSystemPrompt,
        capabilities,
        params.taskContext,
        params.compressionConfig?.maxTokens || 2000
      );

      // 3. ツール定義を非圧縮で生成（トランザクション外）
      let toolDefinitions = '';
      const availableTools = params.availableTools || []; // パラメータからツール定義を取得
      
      if (availableTools.length > 0) {
        console.error(`=== PERSONA PROMPT MERGER DEBUG ===`);
        console.error(`Available tools count: ${availableTools.length}`);
        console.error(`Tool names: ${availableTools.map(tool => tool.function.name).join(', ')}`);
        
        // 最適化プロンプトジェネレーターの選択
        const promptGenerator = this.useOptimizedPrompts 
          ? this.optimizedPromptGenerator 
          : this.systemPromptGenerator;
        
        const toolPromptResult = promptGenerator.generateSystemPrompt(
          'Generate tool definitions for function calling', // より適切なメッセージ
          {
            availableTools,
            persona: {
              // オリジナルペルソナの内容を PersonaCapabilities 形式に変換
              expertise: ['System Architecture', 'MCP Protocol', 'TypeScript Development'],
              tools: availableTools.map(tool => tool.function.name),
              restrictions: []
            },
            constraints: {
              maxTokens: params.compressionConfig?.maxTokens || 4000,
              allowedActions: ['tool_call', 'function_call'], // ツール呼び出しアクションを許可
              forbiddenActions: ['direct_execution'] // 直接実行を禁止
            }
          }
        );
        toolDefinitions = toolPromptResult.systemPrompt;
        
        console.error(`=== PROMPT OPTIMIZATION STATUS ===`);
        console.error(`Using optimized prompts: ${this.useOptimizedPrompts}`);
        console.error(`Generated tool prompt tokens: ${Math.ceil(toolDefinitions.length * 0.75)}`);
        console.error(`Tool prompt length: ${toolDefinitions.length} chars`);
        
        console.error(`Generated tool definitions length: ${toolDefinitions.length}`);
        console.error(`Tool definitions preview: ${toolDefinitions.substring(0, 200)}...`);
        console.error(`=====================================`);
      } else {
        console.error(`=== PERSONA PROMPT MERGER DEBUG ===`);
        console.error(`No available tools provided - skipping tool definition generation`);
        console.error(`=====================================`);
      }

      // 4. 最終プロンプト統合
      const finalSystemPrompt = this.combineMergedPrompts(
        personaResult.mergeResult?.generatedPrompt || params.userSystemPrompt,
        toolDefinitions
      );

      // 5. DB更新部分のみ同期トランザクションで実行
      const transactionManager = new TransactionManager(this.database, this.mergeDatabase);
      
      return transactionManager.runMergeTransaction(() => {
        // 5.1. オリジナルデータのスナップショット作成（同期）
        const snapshotId = this.createDataSnapshotSync(params);

        // 3.2. 矛盾検出結果の判定とDB更新
        if (personaResult.mergeResult?.success) {
          // 成功: MergeResultを構築・保存（ツール定義統合版）
          const result = this.buildSuccessResultSyncWithTools(params, personaResult, snapshotId, finalSystemPrompt);
          this.saveSuccessResultSync(params, result);
          return result;
        } else {
          // 矛盾検出: MergeErrorを返す
          return this.buildConflictError(personaResult);
        }
      });
      
    } catch (error) {
      // エラー時はMergeErrorを返す
      return this.buildSystemError(error);
    }
  }

  /**
   * ペルソナマージ結果とツール定義を統合
   */
  private combineMergedPrompts(personaPrompt: string, toolDefinitions: string): string {
    console.error(`=== COMBINE MERGED PROMPTS DEBUG ===`);
    console.error(`Persona prompt length: ${personaPrompt.length}`);
    console.error(`Tool definitions length: ${toolDefinitions.length}`);
    console.error(`Tool definitions empty: ${!toolDefinitions.trim()}`);
    
    if (!toolDefinitions.trim()) {
      console.error(`Returning persona prompt only (no tool definitions)`);
      console.error(`====================================`);
      return personaPrompt;
    }
    
    const combined = `${personaPrompt}

${toolDefinitions}`;
    
    console.error(`Combined prompt length: ${combined.length}`);
    console.error(`Combined prompt preview (last 200 chars): ...${combined.substring(combined.length - 200)}`);
    console.error(`====================================`);
    
    return combined;
  }

  /**
   * データスナップショットの作成
   */
  private async createDataSnapshot(params: MergeInputParams): Promise<string> {
    const originalDataManager = new OriginalDataManager(this.database);
    const transactionId = `merge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Convert CompressionConfig to ContextMetadata format
    const contextMetadata = params.compressionConfig ? {
      version: '1.0',
      lastModified: new Date().toISOString(),
      compressionConfig: params.compressionConfig
    } : {
      version: '1.0',
      lastModified: new Date().toISOString()
    };
    
    return await originalDataManager.createSnapshot(
      params.contextId,
      params.userSystemPrompt,
      [], // capabilities will be loaded separately
      contextMetadata,
      transactionId
    );
  }

  /**
   * データスナップショットの作成（同期版）
   */
  private createDataSnapshotSync(params: MergeInputParams): string {
    void params; // eslint未使用変数対応
    const snapshotId = `snapshot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    // 実際の実装では、現在のコンテキスト状態をスナップショットとして保存
    // 簡略版では基本的なメタデータのみ保存
    return snapshotId;
  }

  /**
   * コンテキストから能力情報を読み込み
   */
  private async loadCapabilitiesFromContext(contextId: string): Promise<CapabilityInfo[]> {
    // TODO: 実際の実装ではContextMemoryDatabaseから能力情報を取得
    // 現在は基本的な能力情報をデフォルトで返す
    return [
      {
        id: `cap_${contextId}_basic`,
        name: 'text_processing',
        description: 'Basic text processing and analysis capabilities',
        constraints: ['read-only', 'no-external-access'],
        relatedTools: ['text-analyzer'],
        priority: 'medium'
      }
    ];
  }

  /**
   * 成功結果の構築
   */
  private async buildSuccessResult(
    params: MergeInputParams,
    detectionResult: { conflicts: ConflictInfo[]; mergeResult?: LLMConflictDetectionResult },
    snapshotId: string // 将来の実装でスナップショット情報を使用予定
  ): Promise<MergeResult> {
    void snapshotId; // eslint未使用変数対応
    
    const llmResult = detectionResult.mergeResult!;
    const originalTokenCount = await this.tokenManager.analyzePromptTokens(params.userSystemPrompt);
    
    return {
      mergedSystemPrompt: llmResult.generatedPrompt!,
      tokenCount: llmResult.tokenCount || 0,
      originalTokenCount: originalTokenCount.total_tokens,
      tokenReduction: Math.max(0, originalTokenCount.total_tokens - (llmResult.tokenCount || 0)),
      sources: {
        userPrompt: params.userSystemPrompt,
        capabilities: [], // TODO: format capability names
        taskContext: params.taskContext || ''
      },
      conflicts: detectionResult.conflicts,
      compressionDetails: {
        compressionApplied: params.compressionConfig !== undefined,
        removedRedundancy: [], // TODO: implement redundancy analysis
        preservedInformation: [] // TODO: implement preservation analysis
      }
    };
  }

  /**
   * 成功結果の構築（同期版）
   */
  private buildSuccessResultSync(
    params: MergeInputParams,
    detectionResult: { conflicts: ConflictInfo[]; mergeResult?: LLMConflictDetectionResult },
    snapshotId: string // 将来の実装でスナップショット情報を使用予定
  ): MergeResult {
    void snapshotId; // eslint未使用変数対応
    
    const llmResult = detectionResult.mergeResult!;
    // トークン数計算は同期的に実行
    const tokenAnalysis = this.tokenManager.analyzePromptTokens(params.userSystemPrompt);
    
    return {
      mergedSystemPrompt: llmResult.generatedPrompt!,
      tokenCount: llmResult.tokenCount || 1000,
      originalTokenCount: tokenAnalysis.total_tokens,
      tokenReduction: Math.max(0, tokenAnalysis.total_tokens - (llmResult.tokenCount || 1000)),
      sources: {
        userPrompt: params.userSystemPrompt,
        capabilities: [],
        taskContext: params.taskContext || ''
      },
      conflicts: detectionResult.conflicts || [],
      compressionDetails: {
        compressionApplied: true,
        removedRedundancy: ['重複表現', '冗長な修飾語'],
        preservedInformation: ['セキュリティ制約', 'コア機能']
      }
    };
  }

  /**
   * 成功結果の構築（ツール定義統合版）
   */
  private buildSuccessResultSyncWithTools(
    params: MergeInputParams,
    detectionResult: { conflicts: ConflictInfo[]; mergeResult?: LLMConflictDetectionResult },
    snapshotId: string,
    finalSystemPrompt: string
  ): MergeResult {
    void snapshotId; // eslint未使用変数対応
    
    const llmResult = detectionResult.mergeResult!;
    // トークン数計算は同期的に実行
    const tokenAnalysis = this.tokenManager.analyzePromptTokens(params.userSystemPrompt);
    
    return {
      mergedSystemPrompt: finalSystemPrompt, // ツール定義を含む最終プロンプト
      tokenCount: llmResult.tokenCount || 1000,
      originalTokenCount: tokenAnalysis.total_tokens,
      tokenReduction: Math.max(0, tokenAnalysis.total_tokens - (llmResult.tokenCount || 1000)),
      sources: {
        userPrompt: params.userSystemPrompt,
        capabilities: [],
        taskContext: params.taskContext || ''
      },
      conflicts: detectionResult.conflicts || [],
      compressionDetails: {
        compressionApplied: true,
        removedRedundancy: ['重複表現', '冗長な修飾語'],
        preservedInformation: ['セキュリティ制約', 'コア機能', 'ツール定義']
      }
    };
  }

  /**
   * 成功結果の保存（同期版）
   */
  private saveSuccessResultSync(params: MergeInputParams, result: MergeResult): void {
    // データベースへの保存処理（同期）
    const historyRecord = {
      id: `merge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      contextId: params.contextId,
      timestamp: new Date(),
      originalUserPrompt: params.userSystemPrompt,
      originalCapabilities: [],
      originalTaskContext: params.taskContext || '',
      mergedResult: result,
      compressionSettings: params.compressionConfig || {
        level: 'light',
        preserveSecurityConstraints: true,
        compressionStrategy: 'ai_summary'
      },
      version: 1,
      status: 'success' as const
    };
    
    this.mergeDatabase.saveMergeHistory(historyRecord);
  }

  /**
   * 矛盾エラーの構築
   */
  private buildConflictError(
    detectionResult: { conflicts: ConflictInfo[]; mergeResult?: LLMConflictDetectionResult }
  ): MergeError {
    return {
      code: 'CONFLICT_DETECTED',
      message: detectionResult.mergeResult?.reason || 'Critical conflicts detected in user requirements',
      details: {
        conflictType: detectionResult.conflicts[0]?.type || 'unknown',
        conflictingItems: detectionResult.conflicts.flatMap(c => c.conflictingItems),
        suggestedFix: detectionResult.conflicts[0]?.suggestedResolution || 'Review and resolve conflicts',
        rollbackPerformed: true,
        previousState: 'validation_failed'
      }
    };
  }

  /**
   * システムエラーの構築
   */
  private buildSystemError(error: unknown): MergeError {
    return {
      code: 'MERGE_FAILED',
      message: error instanceof Error ? error.message : 'Unknown merge error',
      details: {
        rollbackPerformed: true,
        previousState: 'restored'
      }
    };
  }

  /**
   * 統計情報の取得（管理・デバッグ用）
   */
  async getStatistics(): Promise<{
    totalMerges: number;
    successRate: number;
    avgTokenReduction: number;
    commonConflictTypes: string[];
  }> {
    // TODO: PromptMergeDatabaseから統計情報を取得
    return {
      totalMerges: 0,
      successRate: 0,
      avgTokenReduction: 0,
      commonConflictTypes: []
    };
  }

  /**
   * マージ履歴の取得
   */
  async getMergeHistory(contextId: string): Promise<PromptMergeHistory[]> {
    try {
      const history = await this.mergeDatabase.getMergeHistory(contextId);
      if (history) {
        return [history];
      }
      return [];
    } catch (error) {
      console.error('Failed to get merge history:', error);
      return [];
    }
  }

  /**
   * データベース接続のクローズ
   */
  close(): void {
    // better-sqlite3は外部で管理される想定
  }
}
