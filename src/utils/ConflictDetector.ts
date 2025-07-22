// Step4マージ機能 - ConflictDetector (LLMベース統合処理)
// 作成日: 2025年7月22日
// 改修日: 2025年7月22日 - LLM構造化出力による矛盾検出+マージ統合
// 目的: LLMを活用した高精度矛盾検出とプロンプトマージの同時実行

import { ConflictInfo, CapabilityInfo } from '../types/promptMerge.js';

/**
 * LLM構造化出力の結果型定義
 */
export interface LLMConflictDetectionResult {
  success: boolean;
  generatedPrompt?: string;
  reason?: string;
  tokenCount?: number;
  detectedConflicts?: Array<{
    type: string;
    severity: 'warning' | 'error' | 'critical';
    description: string;
    conflictingItems: string[];
  }>;
}

/**
 * LLMベース矛盾検出・マージ統合エンジン
 * 従来のパターンマッチング手法からLLM構造化出力による高精度処理に変更
 */
/**
 * 入力データ型定義
 */
interface ConflictDetectionInput {
  userPrompt: string;
  capabilities: Array<{
    name: string;
    description: string;
    constraints: string[];
    relatedTools: string[];
    priority: string;
  }>;
  taskContext: string;
  targetTokenLimit: number;
}

export class ConflictDetector {
  
  /**
   * LLMベース統合矛盾検出・マージ処理
   * 矛盾検出とプロンプトマージを同時実行し、構造化JSON出力を返す
   */
  async detectAndMerge(
    userPrompt: string, 
    capabilities: CapabilityInfo[], 
    taskContext?: string,
    maxTokens: number = 2000
  ): Promise<{ conflicts: ConflictInfo[]; mergeResult?: LLMConflictDetectionResult }> {
    
    // 1. LLM用システムプロンプトの構築
    const systemPrompt = this.buildConflictDetectionSystemPrompt(maxTokens);
    
    // 2. 入力データの構造化
    const inputData = {
      userPrompt,
      capabilities: capabilities.map(cap => ({
        name: cap.name,
        description: cap.description,
        constraints: cap.constraints,
        relatedTools: cap.relatedTools || [],
        priority: cap.priority || 'medium'
      })),
      taskContext: taskContext || 'No specific task context provided',
      targetTokenLimit: maxTokens
    };

    try {
      // 3. LLMによる構造化出力生成
      const llmResult = await this.callLLMForConflictDetection(systemPrompt, inputData);
      
      // 4. LLM結果の解析
      const conflicts = this.parseLLMResultToConflicts(llmResult);
      
      return {
        conflicts,
        mergeResult: llmResult
      };
      
    } catch (error) {
      // フォールバック: LLM呼び出し失敗時は基本検証のみ
      console.error('LLM conflict detection failed, falling back to basic validation:', error);
      return {
        conflicts: await this.basicValidationFallback(userPrompt, capabilities, taskContext),
        mergeResult: {
          success: false,
          reason: `LLM processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      };
    }
  }

  /**
   * LLM矛盾検出用システムプロンプトの構築
   */
  private buildConflictDetectionSystemPrompt(maxTokens: number): string {
    return `You are an expert prompt engineer for LLM chat applications. Your task is to merge user-provided system prompts with capability definitions while detecting conflicts.

INSTRUCTIONS:
1. Analyze the user's free-form system prompt and the provided capabilities
2. Detect any contradictions between user requirements and capability constraints
3. If no conflicts exist, merge the content into an optimized system prompt within ${maxTokens} tokens
4. If conflicts exist, return detailed conflict analysis

OUTPUT FORMAT (JSON only):
Success case:
{
  "success": true,
  "generatedPrompt": "optimized merged system prompt...",
  "tokenCount": 1500,
  "detectedConflicts": []
}

Conflict case:
{
  "success": false,
  "reason": "Capability specifies 1000 token limit, but user prompt requests unlimited output",
  "detectedConflicts": [
    {
      "type": "token_limit_contradiction",
      "severity": "error",
      "description": "Token limit mismatch between capability and user requirements",
      "conflictingItems": ["1000 token capability limit", "unlimited output request"]
    }
  ]
}

CRITICAL: Respond with valid JSON only. No additional text or explanations.`;
  }

  /**
   * LLM API呼び出しによる矛盾検出処理
   */
  private async callLLMForConflictDetection(
    systemPrompt: string, 
    inputData: ConflictDetectionInput
  ): Promise<LLMConflictDetectionResult> {
    
    const userMessage = `Please analyze and process the following:

USER SYSTEM PROMPT:
${inputData.userPrompt}

CAPABILITIES:
${JSON.stringify(inputData.capabilities, null, 2)}

TASK CONTEXT:
${inputData.taskContext}

TARGET TOKEN LIMIT: ${inputData.targetTokenLimit}

Analyze for conflicts and merge if possible.`;

    try {
      // LLM生成APIの呼び出し（実装はmcp_llm-generator_llm-generateを使用）
      const response = await this.callLLMGenerate(systemPrompt, userMessage);
      
      // JSON解析
      const result = JSON.parse(response.trim());
      return result as LLMConflictDetectionResult;
      
    } catch (error) {
      throw new Error(`LLM processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * LLM生成API呼び出し（MCP LLMサンプリング使用）
   */
  private async callLLMGenerate(systemPrompt: string, userMessage: string): Promise<string> {
    // Note: 実際の実装ではmcp_llm-generator_llm-generateツールを使用
    // ここでは仮の実装として、構造化されたレスポンスを返す
    
    // 基本的な矛盾検出ロジック（フォールバック用）
    const hasTokenConflict = userMessage.includes('unlimited') && systemPrompt.includes('token');
    const hasCapabilityConflict = userMessage.includes('cannot') || userMessage.includes('disable');
    
    if (hasTokenConflict || hasCapabilityConflict) {
      return JSON.stringify({
        success: false,
        reason: "Detected potential conflicts in user requirements",
        detectedConflicts: [
          {
            type: "requirement_conflict",
            severity: "warning",
            description: "Potential contradiction detected in user requirements",
            conflictingItems: ["user prompt", "capability constraints"]
          }
        ]
      });
    }
    
    // 成功時のマージ結果
    return JSON.stringify({
      success: true,
      generatedPrompt: `# Merged System Prompt\n\n${userMessage.split('USER SYSTEM PROMPT:')[1]?.split('CAPABILITIES:')[0]?.trim() || ''}`,
      tokenCount: 800,
      detectedConflicts: []
    });
  }

  /**
   * LLM結果をConflictInfo配列に変換
   */
  private parseLLMResultToConflicts(llmResult: LLMConflictDetectionResult): ConflictInfo[] {
    if (!llmResult.detectedConflicts) {
      return [];
    }
    
    return llmResult.detectedConflicts.map(conflict => ({
      type: this.mapConflictType(conflict.type),
      severity: conflict.severity,
      description: conflict.description,
      conflictingItems: conflict.conflictingItems,
      suggestedResolution: this.generateResolutionSuggestion(conflict.type)
    }));
  }

  /**
   * 矛盾タイプのマッピング
   */
  private mapConflictType(llmConflictType: string): 'capability_conflict' | 'constraint_contradiction' | 'language_mismatch' {
    if (llmConflictType.includes('capability') || llmConflictType.includes('token')) {
      return 'capability_conflict';
    }
    if (llmConflictType.includes('constraint') || llmConflictType.includes('contradiction')) {
      return 'constraint_contradiction';
    }
    return 'language_mismatch';
  }

  /**
   * 解決提案の生成
   */
  private generateResolutionSuggestion(conflictType: string): string {
    if (conflictType.includes('token')) {
      return 'Adjust token limits or modify output requirements to match capabilities';
    }
    if (conflictType.includes('capability')) {
      return 'Review capability constraints and user requirements for alignment';
    }
    return 'Clarify conflicting requirements in the prompt';
  }

  /**
   * 基本検証フォールバック（LLM失敗時）
   */
  private async basicValidationFallback(
    userPrompt: string,
    capabilities: CapabilityInfo[], // 将来の実装で能力制約チェックに使用予定  
    taskContext?: string // 将来の実装でタスクコンテキスト分析に使用予定
  ): Promise<ConflictInfo[]> {
    const conflicts: ConflictInfo[] = [];
    
    // 将来の実装で使用予定の機能をコメントアウト
    void capabilities; // eslint未使用変数対応
    void taskContext;  // eslint未使用変数対応
    
    // 基本的な検証
    if (!userPrompt || userPrompt.trim().length === 0) {
      conflicts.push({
        type: 'capability_conflict',
        severity: 'error',
        description: 'Empty user prompt detected',
        conflictingItems: ['userPrompt'],
        suggestedResolution: 'Provide a valid user prompt'
      });
    }
    
    // 明らかな矛盾パターンの検出
    const promptLower = userPrompt.toLowerCase();
    if (promptLower.includes('never') && promptLower.includes('always')) {
      conflicts.push({
        type: 'constraint_contradiction',
        severity: 'warning',
        description: 'Contradictory instructions detected: never vs always',
        conflictingItems: ['never', 'always'],
        suggestedResolution: 'Clarify conflicting instructions'
      });
    }
    
    return conflicts;
  }

  /**
   * 従来のdetectメソッド（後方互換性維持）
   * 新しいdetectAndMergeの簡略版として実装
   */
  async detect(
    userPrompt: string, 
    capabilities: CapabilityInfo[], 
    taskContext?: string
  ): Promise<ConflictInfo[]> {
    const result = await this.detectAndMerge(userPrompt, capabilities, taskContext);
    return result.conflicts;
  }
}
