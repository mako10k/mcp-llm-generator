// Sprint4 Phase 1: AI Tool Integration Foundation
// ペルソナ能力管理のための包括的型定義システム
// エラー型定義
export class PersonaCapabilityError extends Error {
    code;
    persona_id;
    constructor(message, code, persona_id) {
        super(message);
        this.code = code;
        this.persona_id = persona_id;
        this.name = 'PersonaCapabilityError';
    }
}
export class PermissionDeniedError extends Error {
    required_permission;
    persona_id;
    constructor(message, required_permission, persona_id) {
        super(message);
        this.required_permission = required_permission;
        this.persona_id = persona_id;
        this.name = 'PermissionDeniedError';
    }
}
export class TaskDelegationError extends Error {
    delegation_id;
    status;
    constructor(message, delegation_id, status) {
        super(message);
        this.delegation_id = delegation_id;
        this.status = status;
        this.name = 'TaskDelegationError';
    }
}
// 定数定義
export const PERSONA_ROLES = {
    ADMIN: 'admin',
    USER: 'user',
    CREATOR: 'creator',
    MANAGER: 'manager'
};
export const PERMISSIONS = {
    CREATE_PERSONA: 'create_persona',
    EDIT_CAPABILITIES: 'edit_capabilities',
    MERGE_PERSONAS: 'merge_personas',
    MANAGE_ROLES: 'manage_roles',
    VIEW_AUDIT: 'view_audit',
    DELEGATE_TASKS: 'delegate_tasks',
    ACCESS_HISTORIES: 'access_histories'
};
export const MERGE_TYPES = {
    CREATE: 'create',
    MERGE: 'merge',
    SPLIT: 'split'
};
export const TASK_STATUS = {
    PENDING: 'pending',
    ACCEPTED: 'accepted',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled'
};
