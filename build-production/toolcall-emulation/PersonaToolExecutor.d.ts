/**
 * Persona Tool Executor
 * 人格ベースのツール実行エミュレーションシステム
 */
import { EnhancedLLMManager } from './EnhancedLLMManager.js';
import { ToolCallEmulationResponse, PersonaToolContext } from './types.js';
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
export declare class PersonaToolExecutor {
    private config;
    private executionCache;
    constructor(config: PersonaToolExecutorConfig);
    /**
     * 人格ベースのツール実行エミュレーション
     */
    executeWithPersona(personaId: string, userMessage: string, context: PersonaToolContext): Promise<PersonaToolExecutionReport>;
    /**
     * 人格情報でコンテキストを強化
     */
    private enhanceContextWithPersona;
    /**
     * 人格用プロンプト構築
     */
    private buildPersonaPrompt;
    /**
     * コンテキストプロンプト構築
     */
    private buildContextPrompt;
    /**
     * ツール実行のシミュレーション
     */
    private simulateToolExecutions;
    /**
     * 個別ツール呼び出しのシミュレーション
     */
    private simulateToolCall;
    /**
     * 人格にとってツールが許可されているかチェック
     */
    private isToolAllowedForPersona;
    /**
     * 全体的な信頼度計算
     */
    private calculateOverallConfidence;
    /**
     * ツール呼び出しの検証
     */
    private validateToolCalls;
    /**
     * リクエストID生成
     */
    private generateRequestId;
    /**
     * 実行レポートの取得
     */
    getExecutionReport(requestId: string): PersonaToolExecutionReport | undefined;
    /**
     * キャッシュクリア
     */
    clearCache(): void;
    /**
     * 統計情報の取得
     */
    getStatistics(): {
        totalExecutions: number;
        averageExecutionTime: number;
        successRate: number;
        averageConfidence: number;
    };
}
