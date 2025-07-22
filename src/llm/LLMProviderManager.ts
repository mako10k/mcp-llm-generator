/**
 * LLM Provider Manager
 * 複数のLLMプロバイダーを統合管理
 */

import { LLMProvider, LLMResponse, Message, LLMRequestOptions } from './LLMProvider.js';
import { OpenAIProvider } from './OpenAIProvider.js';
import { ClaudeProvider } from './ClaudeProvider.js';

export interface LLMManagerConfig {
  defaultProvider?: string;
  providers?: {
    openai?: Record<string, unknown>;
    claude?: Record<string, unknown>;
  };
}

export class LLMProviderManager {
  private providers: Map<string, LLMProvider> = new Map();
  private defaultProvider: string;

  constructor(config: LLMManagerConfig = {}) {
    this.defaultProvider = config.defaultProvider || 'mcp-internal';
    
    // プロバイダーの初期化
    this.initializeProviders(config);
  }

  private initializeProviders(config: LLMManagerConfig): void {
    // OpenAI Provider
    if (process.env.OPENAI_API_KEY || config.providers?.openai) {
      try {
        const openaiProvider = new OpenAIProvider(config.providers?.openai);
        this.providers.set('openai', openaiProvider);
        console.log('✅ OpenAI Provider initialized');
      } catch (error) {
        console.warn('⚠️ OpenAI Provider initialization failed:', error instanceof Error ? error.message : String(error));
      }
    }

    // Claude Provider
    if (process.env.ANTHROPIC_API_KEY || config.providers?.claude) {
      try {
        const claudeProvider = new ClaudeProvider(config.providers?.claude);
        this.providers.set('claude', claudeProvider);
        console.log('✅ Claude Provider initialized');
      } catch (error) {
        console.warn('⚠️ Claude Provider initialization failed:', error instanceof Error ? error.message : String(error));
      }
    }

    console.log(`🔧 LLM Provider Manager initialized with ${this.providers.size} external providers`);
  }

  /**
   * プロバイダーを手動で追加
   */
  addProvider(name: string, provider: LLMProvider): void {
    this.providers.set(name, provider);
    console.log(`✅ Provider '${name}' added to manager`);
  }

  /**
   * 利用可能なプロバイダー一覧を取得
   */
  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * 指定したプロバイダーが利用可能かチェック
   */
  isProviderAvailable(providerName: string): boolean {
    return this.providers.has(providerName);
  }

  /**
   * プロバイダーを取得
   */
  getProvider(providerName?: string): LLMProvider | null {
    const targetProvider = providerName || this.defaultProvider;
    return this.providers.get(targetProvider) || null;
  }

  /**
   * メッセージ生成（プロバイダー指定あり）
   */
  async generateMessage(
    messages: Message[],
    options: LLMRequestOptions & { provider?: string } = {}
  ): Promise<LLMResponse> {
    const { provider: providerName, ...llmOptions } = options;
    
    const provider = this.getProvider(providerName);
    if (!provider) {
      const available = this.getAvailableProviders();
      throw new Error(
        `Provider '${providerName || this.defaultProvider}' not available. ` +
        `Available providers: ${available.join(', ')}`
      );
    }

    return provider.generateMessage(messages, llmOptions);
  }

  /**
   * ストリーミング生成
   */
  async *generateMessageStream(
    messages: Message[],
    options: LLMRequestOptions & { provider?: string } = {}
  ): AsyncIterable<LLMResponse> {
    const { provider: providerName, ...llmOptions } = options;
    
    const provider = this.getProvider(providerName);
    if (!provider) {
      throw new Error(`Provider '${providerName || this.defaultProvider}' not available`);
    }

    if (!provider.generateMessageStream) {
      throw new Error(`Provider '${provider.name}' does not support streaming`);
    }

    yield* provider.generateMessageStream(messages, llmOptions);
  }

  /**
   * Tool Callingサポート
   */
  async generateWithTools(
    messages: Message[],
    tools: unknown[],
    options: LLMRequestOptions & { provider?: string } = {}
  ): Promise<LLMResponse> {
    const { provider: providerName, ...llmOptions } = options;
    
    const provider = this.getProvider(providerName);
    if (!provider) {
      throw new Error(`Provider '${providerName || this.defaultProvider}' not available`);
    }

    if (!provider.supportsToolCalling || !provider.generateWithTools) {
      throw new Error(`Provider '${provider.name}' does not support tool calling`);
    }

    return provider.generateWithTools(messages, tools, llmOptions);
  }

  /**
   * 全プロバイダーの健全性チェック
   */
  async healthCheckAll(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    for (const [name, provider] of this.providers) {
      try {
        results[name] = await provider.healthCheck();
      } catch (error) {
        results[name] = false;
      }
    }
    
    return results;
  }

  /**
   * プロバイダー情報の取得
   */
  getProviderInfo(): Array<{
    name: string;
    supportedModels: string[];
    supportsToolCalling: boolean;
    supportsStreaming: boolean;
  }> {
    return Array.from(this.providers.values()).map(provider => ({
      name: provider.name,
      supportedModels: provider.supportedModels,
      supportsToolCalling: provider.supportsToolCalling,
      supportsStreaming: provider.supportsStreaming
    }));
  }

  /**
   * プロバイダーの使用状況統計
   */
  private usageStats: Record<string, number> = {};

  trackUsage(providerName: string): void {
    this.usageStats[providerName] = (this.usageStats[providerName] || 0) + 1;
  }

  getUsageStats(): Record<string, number> {
    return { ...this.usageStats };
  }

  /**
   * 設定の更新
   */
  updateConfig(config: Partial<LLMManagerConfig>): void {
    if (config.defaultProvider) {
      this.defaultProvider = config.defaultProvider;
    }
    
    // プロバイダー設定の更新は再初期化が必要
    if (config.providers) {
      console.log('⚠️ Provider configuration update requires restart');
    }
  }
}
