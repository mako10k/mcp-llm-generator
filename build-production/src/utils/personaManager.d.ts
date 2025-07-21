import Database from 'better-sqlite3';
import { PersonaCapabilities, TaskDelegation, MergeStrategyType, PromptSecurityLevel, SecurityValidationResult } from '../types/persona.js';
declare global {
    var sharedMemoryTools: {
        handleToolCall(toolName: string, args: any): Promise<{
            content: Array<{
                type: string;
                text: string;
            }>;
        }>;
    } | undefined;
}
export declare class PersonaManager {
    private db;
    private logger;
    constructor(database: Database.Database);
    /**
     * ペルソナ能力の取得
     */
    getPersonaCapabilities(contextId: string): PersonaCapabilities | null;
    /**
     * ペルソナ能力の更新
     */
    updatePersonaCapabilities(contextId: string, capabilities: PersonaCapabilities): boolean;
    /**
     * ロール権限の確認
     */
    checkRolePermissions(contextId: string, requiredPermission: string): boolean;
    /**
     * タスク委譲の作成
     */
    createTaskDelegation(delegation: Omit<TaskDelegation, 'delegation_id' | 'created_at' | 'updated_at'>): string | null;
    /**
     * 適切なペルソナの検索
     */
    findSuitablePersona(requiredCapabilities: string[], excludeContextIds?: string[]): string | null;
    /**
     * プロンプト最適化（セキュリティチェック付き）
     */
    optimizePromptForPersona(contextId: string, basePrompt: string, options?: {
        max_tokens?: number;
        model?: string;
        security_level?: PromptSecurityLevel;
        task_context?: string;
    }): {
        optimized_prompt: string;
        security_result: SecurityValidationResult;
        token_analysis: any;
        applied_optimizations: string[];
    };
    /**
     * ペルソナの親子関係記録
     */
    recordPersonaLineage(parentContextId: string, childContextId: string, relationshipType: 'derived' | 'merged' | 'forked'): boolean;
    /**
     * ペルソナのマージ実行
     */
    mergePersonas(sourceContextIds: string[], targetContextId: string, strategy?: MergeStrategyType): boolean;
    /**
     * 能力マージの実行
     */
    private executeCapabilityMerge;
    /**
     * 使用頻度に基づくトップスキル抽出
     */
    private getTopSkills;
    /**
     * ペルソナ統計の取得
     */
    getPersonaStatistics(): {
        total_personas: number;
        active_delegations: number;
        merge_operations: number;
        security_incidents: number;
    };
    /**
     * 権限階層管理 - 新機能
     */
    createRoleHierarchy(parentRoleId: string, childRoleId: string, contextId: string, roleType: string, permissions: string[], description?: string): boolean;
    /**
     * タスク委譲状況監視 - 新機能
     */
    getDelegationStatus(delegationId: string): {
        status: string;
        progress: number;
        estimated_completion?: Date;
        current_step?: string;
    } | null;
    /**
     * 人格系譜分析 - 新機能
     */
    analyzePersonaLineage(contextId: string): {
        ancestors: Array<{
            context_id: string;
            relation: string;
            depth: number;
        }>;
        descendants: Array<{
            context_id: string;
            relation: string;
            depth: number;
        }>;
        lineage_strength: number;
    };
    /**
     * スマート委譲システム - 新機能
     */
    smartDelegateTask(fromContextId: string, taskDescription: string, requiredCapabilities: string[], options?: {
        priority?: 'low' | 'medium' | 'high' | 'urgent';
        max_candidates?: number;
        exclude_busy?: boolean;
        min_capability_match?: number;
    }): string | null;
    private calculateProgress;
    private getPersonaAncestors;
    private getPersonaDescendants;
    private calculateLineageStrength;
    private rankCandidatesByCapability;
    /**
     * 人格側共有メモリ機能: MCPツール連携
     */
    createSharedMemory(contextId: string, title: string, content: string, permissionLevel?: 'public' | 'edit'): Promise<string | null>;
    searchSharedMemory(contextId: string, keyword: string): Promise<any[]>;
    updateSharedMemory(contextId: string, memoryId: string, title?: string, content?: string): Promise<boolean>;
    deleteSharedMemory(contextId: string, memoryId: string): Promise<boolean>;
    /**
     * 人格側BIFF通知: 会話履歴にシステムロールメッセージとして通知を挿入
     */
    insertBiffNotification(contextId: string): Promise<string | null>;
    /**
     * 人格用会話履歴にBIFF通知を挿入
     */
    enrichConversationWithBiff(contextId: string, messages: Array<{
        role: string;
        content: string;
    }>): Promise<Array<{
        role: string;
        content: string;
    }>>;
}
