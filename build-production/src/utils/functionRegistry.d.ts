/**
 * Sprint4 Phase 2: Function Registry System
 * 人格別実行可能Function定義・セキュリティ制約・権限管理
 */
import Database from 'better-sqlite3';
import { FunctionCallCapability } from './functionCallDispatcher.js';
export interface FunctionDefinition {
    id: string;
    name: string;
    description: string;
    category: 'data_analysis' | 'communication' | 'system_control' | 'information_retrieval' | 'custom';
    parameters: Record<string, {
        type: 'string' | 'number' | 'boolean' | 'object' | 'array';
        description: string;
        required: boolean;
        default?: any;
        validation?: {
            min?: number;
            max?: number;
            pattern?: string;
            enum?: any[];
        };
    }>;
    security: {
        level: 'public' | 'protected' | 'private' | 'admin_only';
        required_permissions: string[];
        restricted_contexts?: string[];
        audit_required: boolean;
    };
    execution: {
        timeout_ms: number;
        max_retries: number;
        background_allowed: boolean;
        resource_limits?: {
            memory_mb?: number;
            cpu_percentage?: number;
        };
    };
    metadata: {
        version: string;
        author: string;
        created_at: string;
        updated_at: string;
        tags: string[];
    };
}
export interface PersonaFunctionBinding {
    persona_id: string;
    function_id: string;
    is_enabled: boolean;
    custom_config?: Record<string, any>;
    security_overrides?: {
        timeout_ms?: number;
        max_retries?: number;
        additional_permissions?: string[];
    };
    created_at: string;
    updated_at: string;
}
export interface FunctionExecutionContext {
    requestId: string;
    fromPersonaId: string;
    toPersonaId: string;
    functionId: string;
    parameters: Record<string, any>;
    security: {
        user_permissions: string[];
        context_restrictions: string[];
    };
    execution: {
        timeout_ms: number;
        retries_remaining: number;
        started_at: string;
    };
}
export declare class FunctionRegistryManager {
    private db;
    private logger;
    private functionDefinitions;
    private personaBindings;
    constructor(database: Database.Database);
    /**
     * データベーステーブルの初期化
     */
    private initializeDatabase;
    /**
     * デフォルトFunction定義の読み込み
     */
    private loadDefaultFunctions;
    /**
     * Function定義の登録
     */
    registerFunction(functionDef: FunctionDefinition): boolean;
    /**
     * ペルソナにFunction実行権限を付与
     */
    bindFunctionToPersona(personaId: string, functionId: string, config?: {
        isEnabled?: boolean;
        customConfig?: Record<string, any>;
        securityOverrides?: Record<string, any>;
    }): boolean;
    /**
     * ペルソナの利用可能Function一覧取得
     */
    getPersonaFunctions(personaId: string): FunctionCallCapability[];
    /**
     * Function実行権限の検証
     */
    validateFunctionExecution(fromPersonaId: string, toPersonaId: string, functionId: string, userPermissions: string[]): {
        valid: boolean;
        reason?: string;
        executionConfig?: {
            timeout_ms: number;
            max_retries: number;
            audit_required: boolean;
        };
    };
    /**
     * ペルソナバインディングキャッシュの更新
     */
    private refreshPersonaBindings;
}
