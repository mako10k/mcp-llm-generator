/**
 * セキュリティレベル定義
 */
export type PromptSecurityLevel = 'low' | 'medium' | 'strict';
/**
 * プロンプトインジェクション検出結果
 */
export interface PromptInjectionAttempt {
    type: 'direct_injection' | 'suspicious_keywords' | 'encoded_content' | 'structural_anomaly';
    pattern: string;
    matched_text: string;
    confidence: number;
    position: number;
}
/**
 * セキュリティ検証結果
 */
export interface SecurityValidationResult {
    is_safe: boolean;
    risk_score: number;
    security_level: PromptSecurityLevel;
    detected_attempts: PromptInjectionAttempt[];
    recommendations: string[];
}
/**
 * ペルソナが持つ能力の詳細定義
 */
export interface PersonaCapabilities {
    expertise?: string[];
    tools?: string[];
    restrictions?: string[];
    performance_metrics?: {
        accuracy_score?: number;
        efficiency_rating?: number;
        reliability_index?: number;
    };
    learning_capabilities?: {
        can_learn_from_context: boolean;
        adaptation_speed: 'slow' | 'medium' | 'fast';
        memory_retention: 'session' | 'persistent' | 'hybrid';
    };
}
export interface PersonaRole {
    id: string;
    persona_id: string;
    role_name: string;
    permissions: string[];
    granted_by?: string;
    granted_at: string;
    expires_at?: string;
    is_active: boolean;
}
export interface PersonaLineage {
    id: string;
    child_persona_id: string;
    parent_persona_id?: string;
    creation_reason?: string;
    merge_type: 'create' | 'merge' | 'split';
    metadata: Record<string, any>;
    created_at: string;
}
export interface TaskDelegation {
    delegation_id: string;
    from_context_id: string;
    to_context_id: string;
    task_description: string;
    required_capabilities: string[];
    priority_level: 'low' | 'medium' | 'high' | 'urgent';
    status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
    result_data?: string;
    delegation_metadata?: string;
    scheduled_at?: string;
    started_at?: string;
    completed_at?: string;
    created_at: string;
    updated_at: string;
}
export interface PersonaMergeAudit {
    id: string;
    primary_persona_id: string;
    secondary_persona_ids: string[];
    merge_strategy: MergeStrategy;
    capability_changes: Record<string, any>;
    permission_changes: Record<string, any>;
    history_access_granted: string[];
    operator_id?: string;
    operation_hash: string;
    created_at: string;
}
export interface MergeStrategy {
    capability_merge: 'union' | 'intersection' | 'manual';
    permission_merge: 'most_restrictive' | 'most_permissive' | 'manual';
    history_access: 'full' | 'summary' | 'restricted';
}
export type MergeStrategyType = 'additive' | 'override' | 'selective' | 'weighted' | 'union' | 'intersection' | 'weighted_average';
export interface CompressedCapabilities {
    expertise_tags: string[];
    tool_summary: string;
    key_restrictions: string[];
}
/**
 * プロンプト最適化オプション
 */
export interface PromptOptimizationOptions {
    max_tokens: number;
    model: string;
    compression_level: 'light' | 'medium' | 'heavy';
    include_expertise_only?: boolean;
    include_tools_only?: boolean;
}
export interface PersonaSimilarity {
    persona_id: string;
    similarity_score: number;
    merge_recommendation: 'auto' | 'manual' | 'reject';
    similar_capabilities: string[];
    conflicting_restrictions: string[];
}
export interface TaskDelegationRequest {
    target_persona_id: string;
    task_description: string;
    required_capabilities: string[];
    max_wait_time?: number;
    priority?: number;
    task_data?: Record<string, any>;
}
export interface CapabilitySearchFilter {
    required_tools?: string[];
    expertise?: string[];
    exclude_restrictions?: string[];
    min_similarity?: number;
    include_self?: boolean;
    include_inactive?: boolean;
}
export interface PromptOptimizationOptions {
    max_tokens: number;
    model: string;
    task_context?: string;
    compression_level: 'light' | 'medium' | 'heavy';
    include_tools_only?: boolean;
    include_expertise_only?: boolean;
}
export interface PermissionCheckResult {
    allowed: boolean;
    reason?: string;
    required_permissions: string[];
    current_permissions: string[];
    missing_permissions: string[];
}
export interface MergedPersona {
    id: string;
    name: string;
    capabilities: PersonaCapabilities;
    permissions: PersonaRole[];
    history_access: string[];
    merge_audit_id: string;
}
export declare class PersonaCapabilityError extends Error {
    code: string;
    persona_id?: string | undefined;
    constructor(message: string, code: string, persona_id?: string | undefined);
}
export declare class PermissionDeniedError extends Error {
    required_permission: string;
    persona_id: string;
    constructor(message: string, required_permission: string, persona_id: string);
}
export declare class TaskDelegationError extends Error {
    delegation_id?: string | undefined;
    status?: string | undefined;
    constructor(message: string, delegation_id?: string | undefined, status?: string | undefined);
}
export declare const PERSONA_ROLES: {
    readonly ADMIN: "admin";
    readonly USER: "user";
    readonly CREATOR: "creator";
    readonly MANAGER: "manager";
};
export declare const PERMISSIONS: {
    readonly CREATE_PERSONA: "create_persona";
    readonly EDIT_CAPABILITIES: "edit_capabilities";
    readonly MERGE_PERSONAS: "merge_personas";
    readonly MANAGE_ROLES: "manage_roles";
    readonly VIEW_AUDIT: "view_audit";
    readonly DELEGATE_TASKS: "delegate_tasks";
    readonly ACCESS_HISTORIES: "access_histories";
};
export declare const MERGE_TYPES: {
    readonly CREATE: "create";
    readonly MERGE: "merge";
    readonly SPLIT: "split";
};
export declare const TASK_STATUS: {
    readonly PENDING: "pending";
    readonly ACCEPTED: "accepted";
    readonly COMPLETED: "completed";
    readonly FAILED: "failed";
    readonly CANCELLED: "cancelled";
};
export type PersonaRoleName = typeof PERSONA_ROLES[keyof typeof PERSONA_ROLES];
export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];
export type MergeType = typeof MERGE_TYPES[keyof typeof MERGE_TYPES];
export type TaskStatus = typeof TASK_STATUS[keyof typeof TASK_STATUS];
