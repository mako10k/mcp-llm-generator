/**
 * Sprint4 Phase 2: 人格間FunctionCall機能
 * FunctionCall Dispatcher Core - 人格間のFunction実行を統括する中央システム
 */
import { PersonaManager } from './personaManager.js';
export interface FunctionCallRequest {
    fromPersonaId: string;
    toPersonaId: string;
    functionName: string;
    parameters: Record<string, any>;
    contextId?: string;
    priority?: 'low' | 'medium' | 'high';
    retryConfig?: {
        maxRetries: number;
        retryDelayMs: number;
    };
}
export interface FunctionCallResponse {
    success: boolean;
    result?: any;
    data?: any;
    error?: string;
    logId: string;
    executionTimeMs: number;
    retryCount?: number;
    metadata?: {
        fromPersonaId: string;
        toPersonaId: string;
        functionName: string;
        timestamp: string;
    };
}
export interface FunctionCallCapability {
    functionName: string;
    description: string;
    parameters: Record<string, {
        type: string;
        description: string;
        required: boolean;
    }>;
    security_level: 'public' | 'protected' | 'private';
    execution_timeout_ms: number;
}
export interface PersonaFunctionRegistry {
    personaId: string;
    availableFunctions: FunctionCallCapability[];
    lastUpdated: Date;
}
export declare class FunctionCallDispatcher {
    private personaManager;
    private logger;
    private functionRegistry;
    private executionEngine;
    constructor(personaManager: PersonaManager);
    /**
     * 人格間Function実行のメインエントリーポイント
     */
    dispatchFunctionCall(request: FunctionCallRequest): Promise<FunctionCallResponse>;
    /**
     * Function実行権限・能力の検証
     */
    private validateFunctionCall;
    /**
     * PersonaManagerを通じたFunction実行
     */
    private executeDelegatedFunction;
    /**
     * エラーレスポンスの構築
     */
    private createErrorResponse;
    /**
     * Function Registry管理
     */
    registerPersonaFunctions(registry: PersonaFunctionRegistry): void;
    /**
     * 利用可能Function一覧の取得
     */
    getAvailableFunctions(personaId: string): FunctionCallCapability[];
}
