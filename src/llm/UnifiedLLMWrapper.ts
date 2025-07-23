/**
 * Unified LLM Wrapper
 * 複数のLLMプロバイダーを統一インターフェースで利用
 * ネイティブモード（Structured Outputs）とエミュレーションモードを自動切り替え
 */

import { LLMProvider, LLMResponse, Message, LLMRequestOptions } from './LLMProvider.js';
import { LLMProviderManager } from './LLMProviderManager.js';
import { OptimizedSystemPromptGenerator } from '../toolcall-emulation/OptimizedSystemPromptGenerator.js';
import { ResponseParser } from '../toolcall-emulation/ResponseParser.js';
import { Tool } from '../types/tool.js';

/**
 * プロバイダー名の型安全性
 */
export type ProviderType = 'openai' | 'claude' | 'mcp-internal';

/**
 * プロバイダー能力情報
 */
export interface ProviderCapabilities {
  supportsNativeStructuredOutputs: boolean;
  supportsFunctionCallEmulation: boolean;
  supportsToolCalling: boolean;
  supportsStreaming: boolean;
  maxTokens: number;
  recommendedMode: 'native' | 'emulation';
}

/**
 * 統一LLM呼び出しオプション
 */
export interface UnifiedLLMOptions extends LLMRequestOptions {
  provider?: ProviderType;
  useNative?: boolean; // true: Structured Outputs, false: エミュレーション
  autoFallback?: boolean; // ネイティブ失敗時にエミュレーションに切り替え
  userId?: string; // 将来的なユーザートラッキング用
  sessionId?: string; // セッション管理用
}

/**
 * ツール呼び出し結果
 */
export interface ToolCallResult extends LLMResponse {
  toolCalls: Array<{
    toolName: string;
    arguments: Record<string, unknown>;
    confidence: number;
    reasoning: string;
  }>;
  shouldCallTool: boolean;
  emulationMode: boolean; // エミュレーションモードで実行されたか
}

export class UnifiedLLMWrapper {
  private providerManager: LLMProviderManager;
  private systemPromptGenerator: OptimizedSystemPromptGenerator;
  private responseParser: ResponseParser;

  constructor(providerManager: LLMProviderManager) {
    this.providerManager = providerManager;
    
    // 最適化されたプロンプト生成器を使用
    this.systemPromptGenerator = new OptimizedSystemPromptGenerator({
      includeExamples: false,
      strictMode: true,
      personaAware: false, // プロンプト統合は別レイヤーで処理
      contextLengthLimit: 4000,
      includeToolValidation: true
    });
    
    this.responseParser = new ResponseParser();
  }

  /**
   * プロバイダー別能力情報を取得
   */
  getProviderCapabilities(provider: ProviderType): ProviderCapabilities {
    const capabilities: Record<ProviderType, ProviderCapabilities> = {
      'openai': {
        supportsNativeStructuredOutputs: true,
        supportsFunctionCallEmulation: true,
        supportsToolCalling: true,
        supportsStreaming: true,
        maxTokens: 128000,
        recommendedMode: 'native'
      },
      'claude': {
        supportsNativeStructuredOutputs: true,
        supportsFunctionCallEmulation: true,
        supportsToolCalling: true,
        supportsStreaming: true,
        maxTokens: 200000,
        recommendedMode: 'native'
      },
      'mcp-internal': {
        supportsNativeStructuredOutputs: false,
        supportsFunctionCallEmulation: true,
        supportsToolCalling: false,
        supportsStreaming: false,
        maxTokens: 100000, // MCP依存
        recommendedMode: 'emulation'
      }
    };

    return capabilities[provider];
  }

  /**
   * 基本的なメッセージ生成
   */
  async generate(
    messages: Message[],
    options: UnifiedLLMOptions = {}
  ): Promise<LLMResponse> {
    const provider = this.getProvider(options.provider);
    
    try {
      const response = await provider.generateMessage(messages, options);
      
      return {
        ...response,
        metadata: {
          ...response.metadata,
          provider: options.provider,
          unifiedWrapper: true
        }
      };
    } catch (error) {
      this.handleGenerationError(error, options);
    }
  }

  /**
   * ツール呼び出し（ネイティブ/エミュレーション自動判定）
   */
  async generateWithTools(
    messages: Message[],
    tools: Tool[],
    options: UnifiedLLMOptions = {}
  ): Promise<ToolCallResult> {
    const providerType = options.provider || 'mcp-internal';
    const capabilities = this.getProviderCapabilities(providerType);
    const provider = this.getProvider(providerType);
    
    // モード決定：明示指定 > 自動判定 > プロバイダー推奨
    const useNative = options.useNative !== undefined 
      ? options.useNative 
      : capabilities.recommendedMode === 'native' && capabilities.supportsNativeStructuredOutputs;

    try {
      if (useNative && capabilities.supportsNativeStructuredOutputs) {
        // ネイティブモード：Structured Outputs使用
        return await this.callNativeMode(provider, messages, tools, options);
      } else {
        // エミュレーションモード：プロンプト誘導 + パース
        return await this.callEmulationMode(provider, messages, tools, options);
      }
    } catch (error) {
      if (options.autoFallback && useNative && capabilities.supportsFunctionCallEmulation) {
        // フォールバック：ネイティブ失敗時にエミュレーションに切り替え
        console.warn('Native mode failed, falling back to emulation mode:', error);
        return await this.callEmulationMode(provider, messages, tools, options);
      }
      throw error;
    }
  }

  /**
   * ネイティブモード（Structured Outputs）
   */
  private async callNativeMode(
    provider: LLMProvider,
    messages: Message[],
    tools: Tool[],
    options: UnifiedLLMOptions
  ): Promise<ToolCallResult> {
    if (!provider.generateWithTools) {
      throw new Error('Provider does not support native tool calling');
    }

    const response = await provider.generateWithTools(messages, tools, options);
    
    // TODO: Structured Outputs の結果をToolCallResultに変換
    // 現在は基本実装（プロバイダー側の実装完了後に改善）
    return {
      ...response,
      toolCalls: [],
      shouldCallTool: false,
      emulationMode: false,
      metadata: {
        ...response.metadata,
        nativeMode: true
      }
    };
  }

  /**
   * エミュレーションモード（プロンプト誘導 + パース）
   */
  private async callEmulationMode(
    provider: LLMProvider,
    messages: Message[],
    tools: Tool[],
    options: UnifiedLLMOptions
  ): Promise<ToolCallResult> {
    // SystemPromptGenerator でツール呼び出し用プロンプト生成
    const toolPrompt = this.systemPromptGenerator.generateSystemPrompt(
      messages[messages.length - 1]?.content || '',
      {
        availableTools: tools,
        constraints: {
          maxTokens: options.maxTokens || 2000,
          allowedActions: ['tool_call', 'function_call'],
          forbiddenActions: ['direct_execution']
        }
      }
    );

    // システムプロンプトを統合してメッセージ生成
    const enhancedMessages: Message[] = [
      { role: 'system', content: toolPrompt.systemPrompt },
      ...messages
    ];

    const response = await provider.generateMessage(enhancedMessages, options);

    // ResponseParser でツール呼び出しを抽出・パース
    const parsedResult = await this.responseParser.parseToolCallResponse(response.content);

    if (!parsedResult.success || !parsedResult.data) {
      return {
        ...response,
        toolCalls: [],
        shouldCallTool: false,
        emulationMode: true,
        metadata: {
          ...response.metadata,
          emulationMode: true,
          originalPrompt: toolPrompt.systemPrompt,
          parseErrors: parsedResult.errors
        }
      };
    }

    // ParseResultからToolCallResultに変換
    const toolCallData = parsedResult.data;
    const toolCalls = toolCallData.tool_calls?.map(call => ({
      toolName: call.tool_name,
      arguments: call.arguments,
      confidence: call.confidence || 0.8,
      reasoning: call.reasoning || ''
    })) || [];

    return {
      ...response,
      toolCalls,
      shouldCallTool: toolCallData.should_call_tool || toolCalls.length > 0,
      emulationMode: true,
      metadata: {
        ...response.metadata,
        emulationMode: true,
        originalPrompt: toolPrompt.systemPrompt,
        parseConfidence: parsedResult.metadata.confidence
      }
    };
  }

  /**
   * プロバイダーを取得（エラーハンドリング付き）
   */
  private getProvider(providerType?: ProviderType): LLMProvider {
    const provider = this.providerManager.getProvider(providerType);
    if (!provider) {
      const available = this.providerManager.getAvailableProviders();
      throw new Error(
        `Provider '${providerType}' not available. Available: ${available.join(', ')}`
      );
    }
    return provider;
  }

  /**
   * 生成エラーのハンドリング
   */
  private handleGenerationError(error: unknown, options: UnifiedLLMOptions): never {
    console.error('UnifiedLLMWrapper generation error:', error);
    
    const errorInfo = {
      provider: options.provider,
      useNative: options.useNative,
      timestamp: new Date().toISOString()
    };

    if (error instanceof Error) {
      throw new Error(`LLM generation failed (${JSON.stringify(errorInfo)}): ${error.message}`);
    } else {
      throw new Error(`LLM generation failed (${JSON.stringify(errorInfo)}): Unknown error`);
    }
  }
}
