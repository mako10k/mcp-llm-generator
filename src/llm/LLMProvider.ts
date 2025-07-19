/**
 * LLM Provider Interface
 * 外部LLM APIの抽象化インターフェース
 */

export interface LLMResponse {
  content: string;
  model: string;
  stopReason?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
  metadata?: Record<string, any>;
}

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMRequestOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stop?: string[];
  stream?: boolean;
  tools?: any[];
  toolChoice?: any;
  metadata?: Record<string, any>;
}

export interface LLMProvider {
  readonly name: string;
  readonly supportedModels: string[];
  readonly supportsToolCalling: boolean;
  readonly supportsStreaming: boolean;

  /**
   * 基本的なメッセージ生成
   */
  generateMessage(
    messages: Message[],
    options?: LLMRequestOptions
  ): Promise<LLMResponse>;

  /**
   * ストリーミング生成（対応している場合）
   */
  generateMessageStream?(
    messages: Message[],
    options?: LLMRequestOptions
  ): AsyncIterable<LLMResponse>;

  /**
   * Tool Calling対応（対応している場合）
   */
  generateWithTools?(
    messages: Message[],
    tools: any[],
    options?: LLMRequestOptions
  ): Promise<LLMResponse>;

  /**
   * プロバイダーの健全性チェック
   */
  healthCheck(): Promise<boolean>;

  /**
   * モデル一覧の取得
   */
  getAvailableModels?(): Promise<string[]>;
}

export abstract class BaseLLMProvider implements LLMProvider {
  abstract readonly name: string;
  abstract readonly supportedModels: string[];
  abstract readonly supportsToolCalling: boolean;
  abstract readonly supportsStreaming: boolean;

  abstract generateMessage(
    messages: Message[],
    options?: LLMRequestOptions
  ): Promise<LLMResponse>;

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.generateMessage([
        { role: 'user', content: 'Hello' }
      ], { maxTokens: 10 });
      return !!response.content;
    } catch (error) {
      console.error(`Health check failed for ${this.name}:`, error);
      return false;
    }
  }

  /**
   * 共通のエラーハンドリング
   */
  protected handleError(error: any, operation: string): never {
    console.error(`${this.name} ${operation} error:`, error);
    if (error.response?.status === 401) {
      throw new Error(`${this.name}: Invalid API key`);
    } else if (error.response?.status === 429) {
      throw new Error(`${this.name}: Rate limit exceeded`);
    } else if (error.response?.status === 404) {
      throw new Error(`${this.name}: Model not found`);
    } else {
      throw new Error(`${this.name}: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * APIキーの検証
   */
  protected validateApiKey(apiKey: string | undefined, providerName: string): string {
    if (!apiKey) {
      throw new Error(`${providerName}: API key is required. Set environment variable.`);
    }
    return apiKey;
  }
}
