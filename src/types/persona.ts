// Sprint4 Phase 1: AI Tool Integration Foundation
// ペルソナ能力管理のための包括的型定義システム

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
  confidence: number; // 0.0-1.0
  position: number;   // -1 if not applicable
}

/**
 * セキュリティ検証結果
 */
export interface SecurityValidationResult {
  is_safe: boolean;
  risk_score: number; // 0-100
  security_level: PromptSecurityLevel;
  detected_attempts: PromptInjectionAttempt[];
  recommendations: string[];
}

/**
 * ペルソナが持つ能力の詳細定義
 */
export interface PersonaCapabilities {
  // 専門分野タグ
  expertise: string[];
  
  // 利用可能なツール群
  tools: string[];
  
  // 制限事項
  restrictions: string[];
  
  // パフォーマンス指標
  performance_metrics?: {
    accuracy_score?: number;
    efficiency_rating?: number;
    reliability_index?: number;
  };
  
  // 学習・適応能力
  learning_capabilities?: {
    can_learn_from_context: boolean;
    adaptation_speed: 'slow' | 'medium' | 'fast';
    memory_retention: 'session' | 'persistent' | 'hybrid';
  };
}

export interface PersonaRole {
  id: string;
  persona_id: string;
  role_name: string;                  // "admin", "user", "creator", "manager"
  permissions: string[];              // 権限配列
  granted_by?: string;               // 付与者ID
  granted_at: string;
  expires_at?: string;               // 権限有効期限
  is_active: boolean;
}

export interface PersonaLineage {
  id: string;
  child_persona_id: string;          // 子人格ID
  parent_persona_id?: string;        // 親人格ID
  creation_reason?: string;          // 作成理由
  merge_type: 'create' | 'merge' | 'split';
  metadata: Record<string, any>;     // 追加メタデータ
  created_at: string;
}

export interface TaskDelegation {
  delegation_id: string;
  from_context_id: string;           // 委譲元人格
  to_context_id: string;             // 委譲先人格
  task_description: string;
  required_capabilities: string[];   // 必要能力配列
  priority_level: 'low' | 'medium' | 'high' | 'urgent'; // 優先度レベル
  status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  result_data?: string;              // 実行結果（JSON）
  delegation_metadata?: string;      // 追加メタデータ（JSON）
  scheduled_at?: string;             // スケジュール日時
  started_at?: string;               // 開始日時
  completed_at?: string;             // 完了日時
  created_at: string;                // 作成日時
  updated_at: string;                // 更新日時
}

export interface PersonaMergeAudit {
  id: string;
  primary_persona_id: string;        // 主人格ID
  secondary_persona_ids: string[];   // 統合された人格ID配列
  merge_strategy: MergeStrategy;     // 統合戦略
  capability_changes: Record<string, any>; // 能力変更差分
  permission_changes: Record<string, any>; // 権限変更差分
  history_access_granted: string[];  // 付与された履歴アクセス権
  operator_id?: string;              // 操作者ID
  operation_hash: string;            // 改ざん検知用ハッシュ
  created_at: string;
}

// 統合戦略インターフェース
export interface MergeStrategy {
  capability_merge: 'union' | 'intersection' | 'manual';
  permission_merge: 'most_restrictive' | 'most_permissive' | 'manual';
  history_access: 'full' | 'summary' | 'restricted';
}

// 統合戦略タイプ（データベース用）
export type MergeStrategyType = 'additive' | 'override' | 'selective' | 'weighted' | 'union' | 'intersection' | 'weighted_average';

// 能力情報の圧縮版（プロンプト最適化用）
export interface CompressedCapabilities {
  expertise_tags: string[];          // 最大5個
  tool_summary: string;             // 20文字以内
  key_restrictions: string[];       // 最大3個
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

// 人格類似度分析結果
export interface PersonaSimilarity {
  persona_id: string;
  similarity_score: number;         // 0.0-1.0
  merge_recommendation: 'auto' | 'manual' | 'reject';
  similar_capabilities: string[];   // 類似する能力
  conflicting_restrictions: string[]; // 矛盾する制限
}

// タスク委譲リクエスト
export interface TaskDelegationRequest {
  target_persona_id: string;
  task_description: string;
  required_capabilities: string[];
  max_wait_time?: number;           // 秒単位
  priority?: number;               // 1-10
  task_data?: Record<string, any>;
}

// 能力検索フィルター
export interface CapabilitySearchFilter {
  required_tools?: string[];
  expertise?: string[];
  exclude_restrictions?: string[];
  min_similarity?: number;
  include_self?: boolean;
  include_inactive?: boolean;
}

// プロンプト最適化オプション
export interface PromptOptimizationOptions {
  max_tokens: number;
  model: string;
  task_context?: string;
  compression_level: 'light' | 'medium' | 'heavy';
  include_tools_only?: boolean;
  include_expertise_only?: boolean;
}

// 権限チェック結果
export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  required_permissions: string[];
  current_permissions: string[];
  missing_permissions: string[];
}

// 統合された人格情報
export interface MergedPersona {
  id: string;
  name: string;
  capabilities: PersonaCapabilities;
  permissions: PersonaRole[];
  history_access: string[];         // アクセス可能な履歴のpersona_id配列
  merge_audit_id: string;          // 統合監査ログID
}

// エラー型定義
export class PersonaCapabilityError extends Error {
  constructor(
    message: string,
    public code: string,
    public persona_id?: string
  ) {
    super(message);
    this.name = 'PersonaCapabilityError';
  }
}

export class PermissionDeniedError extends Error {
  constructor(
    message: string,
    public required_permission: string,
    public persona_id: string
  ) {
    super(message);
    this.name = 'PermissionDeniedError';
  }
}

export class TaskDelegationError extends Error {
  constructor(
    message: string,
    public delegation_id?: string,
    public status?: string
  ) {
    super(message);
    this.name = 'TaskDelegationError';
  }
}

// 定数定義
export const PERSONA_ROLES = {
  ADMIN: 'admin',
  USER: 'user', 
  CREATOR: 'creator',
  MANAGER: 'manager'
} as const;

export const PERMISSIONS = {
  CREATE_PERSONA: 'create_persona',
  EDIT_CAPABILITIES: 'edit_capabilities',
  MERGE_PERSONAS: 'merge_personas',
  MANAGE_ROLES: 'manage_roles',
  VIEW_AUDIT: 'view_audit',
  DELEGATE_TASKS: 'delegate_tasks',
  ACCESS_HISTORIES: 'access_histories'
} as const;

export const MERGE_TYPES = {
  CREATE: 'create',
  MERGE: 'merge',
  SPLIT: 'split'
} as const;

export const TASK_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
} as const;

export type PersonaRoleName = typeof PERSONA_ROLES[keyof typeof PERSONA_ROLES];
export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];
export type MergeType = typeof MERGE_TYPES[keyof typeof MERGE_TYPES];
export type TaskStatus = typeof TASK_STATUS[keyof typeof TASK_STATUS];
