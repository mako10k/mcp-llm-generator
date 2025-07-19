/**
 * Persona Tool Executor
 * 人格ベースのツール実行エミュレーションシステム
 */

import { EnhancedLLMManager } from './EnhancedLLMManager.js';
import { 
  Tool, 
  ToolCallEmulationResponse, 
  PersonaToolContext,
  ToolCallResult
} from './types.js';
import { PersonaManager } from '../utils/personaManager.js';

export interface PersonaToolExecutorConfig {
  llmManager: EnhancedLLMManager;
  personaManager: PersonaManager;
  defaultConfidenceThreshold: number;
  enableToolValidation: boolean;
  maxConcurrentCalls: number;
}

export interface ToolExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  executionTime: number;
  toolName: string;
  confidence: number;
}

export interface PersonaToolExecutionReport {
  personaId: string;
  requestId: string;
  totalExecutionTime: number;
  toolCalls: ToolExecutionResult[];
  emulationResponse: ToolCallEmulationResponse;
  metadata: {
    modelUsed: string;
    tokensUsed?: number;
    confidenceScore: number;
    validationPassed: boolean;
  };
}

export class PersonaToolExecutor {
  private config: PersonaToolExecutorConfig;
  private executionCache: Map<string, PersonaToolExecutionReport> = new Map();

  constructor(config: PersonaToolExecutorConfig) {
    this.config = config;
  }

  /**
   * 人格ベースのツール実行エミュレーション
   */
  async executeWithPersona(
    personaId: string,
    userMessage: string,
    context: PersonaToolContext
  ): Promise<PersonaToolExecutionReport> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      // 人格情報の取得
      const persona = this.config.personaManager.getPersonaCapabilities(personaId);
      if (!persona) {
        throw new Error(`Persona not found: ${personaId}`);
      }

      // 人格専用のシステムプロンプト生成
      const enhancedContext = this.enhanceContextWithPersona(context, persona);

      // ツール呼び出しエミュレーション実行
      const emulationResponse = await this.config.llmManager.emulateToolCalls(
        userMessage,
        {
          availableTools: enhancedContext.availableTools,
          persona: this.buildPersonaPrompt(persona),
          context: this.buildContextPrompt(enhancedContext),
          strictMode: true,
          confidenceThreshold: this.config.defaultConfidenceThreshold
        }
      );

      // ツール実行のシミュレーション
      const toolExecutions = await this.simulateToolExecutions(
        emulationResponse.tool_calls,
        enhancedContext
      );

      const totalExecutionTime = Date.now() - startTime;

      const report: PersonaToolExecutionReport = {
        personaId,
        requestId,
        totalExecutionTime,
        toolCalls: toolExecutions,
        emulationResponse,
        metadata: {
          modelUsed: 'gpt-4o-mini', // TODO: 実際のモデルを取得
          confidenceScore: this.calculateOverallConfidence(emulationResponse),
          validationPassed: this.validateToolCalls(emulationResponse.tool_calls),
          tokensUsed: undefined // TODO: 実際のトークン使用量を取得
        }
      };

      // キャッシュに保存
      this.executionCache.set(requestId, report);

      return report;

    } catch (error) {
      const errorReport: PersonaToolExecutionReport = {
        personaId,
        requestId,
        totalExecutionTime: Date.now() - startTime,
        toolCalls: [],
        emulationResponse: {
          should_call_tool: false,
          tool_calls: [],
          response_text: `Error: ${error instanceof Error ? error.message : String(error)}`
        },
        metadata: {
          modelUsed: 'error',
          confidenceScore: 0,
          validationPassed: false
        }
      };

      return errorReport;
    }
  }

  /**
   * 人格情報でコンテキストを強化
   */
  private enhanceContextWithPersona(
    context: PersonaToolContext,
    persona: any
  ): PersonaToolContext {
    // 人格の能力に基づいてツールをフィルタリング
    const allowedToolCapabilities = persona.tools || [];
    const filteredTools = context.availableTools.filter(tool => 
      this.isToolAllowedForPersona(tool, allowedToolCapabilities)
    );

    // 人格制約の適用
    const enhancedConstraints = {
      ...context.constraints,
      maxTokens: Math.min(context.constraints.maxTokens || 4000, 4000),
      temperature: context.constraints.temperature,
      allowedTools: filteredTools.map(t => t.function.name),
      forbiddenActions: [...(context.constraints.forbiddenActions || []), ...(persona.restrictions || [])]
    };

    return {
      ...context,
      availableTools: filteredTools,
      constraints: enhancedConstraints
    };
  }

  /**
   * 人格用プロンプト構築
   */
  private buildPersonaPrompt(persona: any): string {
    return `You are a specialized AI assistant with the following capabilities.

Expertise Areas: ${persona.expertise ? persona.expertise.join(', ') : 'General knowledge'}

Available Tools: ${persona.tools ? persona.tools.join(', ') : 'Basic tools'}

Restrictions: ${persona.restrictions ? persona.restrictions.join(', ') : 'None'}

Remember to work within your defined capabilities while analyzing tool usage needs.`;
  }

  /**
   * コンテキストプロンプト構築
   */
  private buildContextPrompt(context: PersonaToolContext): string {
    const historyText = context.conversationHistory
      .slice(-5) // 最新5件のみ
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    return `Conversation History:
${historyText}

Available Tools: ${context.availableTools.map(t => t.function.name).join(', ')}

Constraints:
- Max Tokens: ${context.constraints.maxTokens || 4000}
- Temperature: ${context.constraints.temperature || 0.7}
- Allowed Tools: ${context.constraints.allowedTools?.join(', ') || 'All'}
${context.constraints.forbiddenActions?.length ? 
  `- Forbidden Actions: ${context.constraints.forbiddenActions.join(', ')}` : ''}`;
  }

  /**
   * ツール実行のシミュレーション
   */
  private async simulateToolExecutions(
    toolCalls: ToolCallResult[],
    context: PersonaToolContext
  ): Promise<ToolExecutionResult[]> {
    const results: ToolExecutionResult[] = [];

    for (const toolCall of toolCalls) {
      const startTime = Date.now();
      
      try {
        // 実際のツール実行の代わりにシミュレーション結果を生成
        const simulationResult = await this.simulateToolCall(toolCall, context);
        
        results.push({
          success: true,
          result: simulationResult,
          executionTime: Date.now() - startTime,
          toolName: toolCall.tool_name,
          confidence: toolCall.confidence
        });
      } catch (error) {
        results.push({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          executionTime: Date.now() - startTime,
          toolName: toolCall.tool_name,
          confidence: toolCall.confidence
        });
      }
    }

    return results;
  }

  /**
   * 個別ツール呼び出しのシミュレーション
   */
  private async simulateToolCall(
    toolCall: ToolCallResult,
    context: PersonaToolContext
  ): Promise<any> {
    // Phase 1A では実際のツール実行は行わず、構造化されたシミュレーション結果を返す
    const simulationResponse = {
      tool_name: toolCall.tool_name,
      arguments_received: toolCall.arguments,
      simulated_result: `Simulated execution of ${toolCall.tool_name} with confidence ${toolCall.confidence}`,
      execution_context: {
        persona_id: context.personaId,
        timestamp: new Date().toISOString(),
        reasoning: toolCall.reasoning
      }
    };

    // 短い遅延でリアルな実行時間をシミュレート
    await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 100));

    return simulationResponse;
  }

  /**
   * 人格にとってツールが許可されているかチェック
   */
  private isToolAllowedForPersona(tool: Tool, capabilities: string[]): boolean {
    if (capabilities.length === 0) return true;
    
    // 単純な文字列マッチング（実際の実装ではより複雑な権限システムが必要）
    return capabilities.some(cap => 
      tool.function.name.toLowerCase().includes(cap.toLowerCase()) ||
      tool.function.description.toLowerCase().includes(cap.toLowerCase())
    );
  }

  /**
   * 全体的な信頼度計算
   */
  private calculateOverallConfidence(response: ToolCallEmulationResponse): number {
    if (response.tool_calls.length === 0) {
      return response.should_call_tool ? 0.1 : 0.9;
    }

    const avgConfidence = response.tool_calls.reduce(
      (sum, call) => sum + call.confidence, 0
    ) / response.tool_calls.length;

    return avgConfidence;
  }

  /**
   * ツール呼び出しの検証
   */
  private validateToolCalls(toolCalls: ToolCallResult[]): boolean {
    if (!this.config.enableToolValidation) return true;

    return toolCalls.every(call => {
      // 基本的な検証
      return call.tool_name && 
             call.arguments && 
             call.confidence >= 0 && 
             call.confidence <= 1 &&
             call.reasoning;
    });
  }

  /**
   * リクエストID生成
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 実行レポートの取得
   */
  getExecutionReport(requestId: string): PersonaToolExecutionReport | undefined {
    return this.executionCache.get(requestId);
  }

  /**
   * キャッシュクリア
   */
  clearCache(): void {
    this.executionCache.clear();
  }

  /**
   * 統計情報の取得
   */
  getStatistics(): {
    totalExecutions: number;
    averageExecutionTime: number;
    successRate: number;
    averageConfidence: number;
  } {
    const reports = Array.from(this.executionCache.values());
    
    if (reports.length === 0) {
      return {
        totalExecutions: 0,
        averageExecutionTime: 0,
        successRate: 0,
        averageConfidence: 0
      };
    }

    const totalTime = reports.reduce((sum, r) => sum + r.totalExecutionTime, 0);
    const successfulReports = reports.filter(r => r.metadata.validationPassed);
    const totalConfidence = reports.reduce((sum, r) => sum + r.metadata.confidenceScore, 0);

    return {
      totalExecutions: reports.length,
      averageExecutionTime: totalTime / reports.length,
      successRate: successfulReports.length / reports.length,
      averageConfidence: totalConfidence / reports.length
    };
  }
}
