/**
 * MCP Provider Implementation
 * MCP Samplerの createMessage 機能をLLMProviderインターフェースでラップ
 */

import { BaseLLMProvider, LLMProvider, LLMResponse, Message, LLMRequestOptions } from './LLMProvider.js';
import { CreateMessageCallback } from '../contextMemory/types.js';

export interface MCPProviderConfig {
  createMessageCallback?: CreateMessageCallback;
  defaultModel?: string;
}

export class MCPProvider extends BaseLLMProvider implements LLMProvider {
  readonly name = 'mcp-internal';
  readonly supportedModels = ['mcp-default'];
  readonly supportsToolCalling = true; // エミュレーション経由で対応
  readonly supportsStreaming = false; // MCP createMessage は非対応

  private createMessageCallback?: CreateMessageCallback;
  private defaultModel: string;

  constructor(config: MCPProviderConfig = {}) {
    super();
    this.createMessageCallback = config.createMessageCallback;
    this.defaultModel = config.defaultModel || 'mcp-default';
  }

  /**
   * CreateMessageCallback を設定（外部から注入）
   */
  setCreateMessageCallback(callback: CreateMessageCallback): void {
    this.createMessageCallback = callback;
  }

  /**
   * 基本的なメッセージ生成（MCP createMessage経由）
   */
  async generateMessage(
    messages: Message[],
    options: LLMRequestOptions = {}
  ): Promise<LLMResponse> {
    if (!this.createMessageCallback) {
      throw new Error('MCP Provider: createMessageCallback not set. Call setCreateMessageCallback() first.');
    }

    try {
      // LLMProvider Message[] → MCP MCPMessage[] 変換
      const mcpMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content // 単純な string として変換
      }));

      // MCP sampling options 作成
      const samplingOptions = {
        maxTokens: options.maxTokens,
        temperature: options.temperature,
        stopSequences: options.stop
      };

      // MCP createMessage 呼び出し
      const mcpResponse = await this.createMessageCallback(mcpMessages, samplingOptions);
      
      // MCP Response → LLMResponse 変換
      return this.convertMCPResponse(mcpResponse, options);
      
    } catch (error) {
      this.handleError(error, 'generateMessage');
    }
  }

  /**
   * Tool Calling対応（FunctionCall エミュレーション経由）
   */
  async generateWithTools(
    messages: Message[],
    tools: unknown[],
    options: LLMRequestOptions = {}
  ): Promise<LLMResponse> {
    // TODO: SystemPromptGenerator + エミュレーション経由でツール呼び出し実装
    // 現在は基本的なメッセージ生成にフォールバック
    return this.generateMessage(messages, options);
  }

  /**
   * プロバイダーの健全性チェック
   */
  async healthCheck(): Promise<boolean> {
    if (!this.createMessageCallback) {
      return false;
    }
    
    try {
      const testMessages = [{
        role: 'user' as const,
        content: 'Hello' // 単純な string として設定
      }];
      
      const response = await this.createMessageCallback(testMessages, { maxTokens: 10 });
      return !!response;
    } catch (error) {
      console.error('MCP Provider health check failed:', error);
      return false;
    }
  }

  /**
   * MCP Response を LLMResponse に変換
   */
  private convertMCPResponse(mcpResponse: unknown, options: LLMRequestOptions): LLMResponse {
    // MCP response の構造に合わせて変換
    // TODO: 実際のMCP response 形式に基づいて実装
    const response = mcpResponse as Record<string, unknown>;
    
    return {
      content: (response?.content as string) || String(mcpResponse),
      model: options.model || this.defaultModel,
      usage: {
        inputTokens: 0, // MCP では取得不可
        outputTokens: 0, // MCP では取得不可 
        totalTokens: 0
      },
      metadata: {
        provider: 'mcp-internal',
        originalResponse: mcpResponse
      }
    };
  }
}
