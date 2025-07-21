/**
 * LLM Provider Manager
 * 複数のLLMプロバイダーを統合管理
 */
import { LLMProvider, LLMResponse, Message, LLMRequestOptions } from './LLMProvider.js';
export interface LLMManagerConfig {
    defaultProvider?: string;
    providers?: {
        openai?: any;
        claude?: any;
    };
}
export declare class LLMProviderManager {
    private providers;
    private defaultProvider;
    constructor(config?: LLMManagerConfig);
    private initializeProviders;
    /**
     * プロバイダーを手動で追加
     */
    addProvider(name: string, provider: LLMProvider): void;
    /**
     * 利用可能なプロバイダー一覧を取得
     */
    getAvailableProviders(): string[];
    /**
     * 指定したプロバイダーが利用可能かチェック
     */
    isProviderAvailable(providerName: string): boolean;
    /**
     * プロバイダーを取得
     */
    getProvider(providerName?: string): LLMProvider | null;
    /**
     * メッセージ生成（プロバイダー指定あり）
     */
    generateMessage(messages: Message[], options?: LLMRequestOptions & {
        provider?: string;
    }): Promise<LLMResponse>;
    /**
     * ストリーミング生成
     */
    generateMessageStream(messages: Message[], options?: LLMRequestOptions & {
        provider?: string;
    }): AsyncIterable<LLMResponse>;
    /**
     * Tool Callingサポート
     */
    generateWithTools(messages: Message[], tools: any[], options?: LLMRequestOptions & {
        provider?: string;
    }): Promise<LLMResponse>;
    /**
     * 全プロバイダーの健全性チェック
     */
    healthCheckAll(): Promise<Record<string, boolean>>;
    /**
     * プロバイダー情報の取得
     */
    getProviderInfo(): Array<{
        name: string;
        supportedModels: string[];
        supportsToolCalling: boolean;
        supportsStreaming: boolean;
    }>;
    /**
     * プロバイダーの使用状況統計
     */
    private usageStats;
    trackUsage(providerName: string): void;
    getUsageStats(): Record<string, number>;
    /**
     * 設定の更新
     */
    updateConfig(config: Partial<LLMManagerConfig>): void;
}
