-- Sprint4 Phase 1: 人格能力システム用テーブル追加
-- 実行日: 2025-07-19

-- 1. 人格能力情報テーブル
CREATE TABLE IF NOT EXISTS persona_capabilities (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    persona_id TEXT NOT NULL,
    tools JSON NOT NULL DEFAULT '[]',           -- 利用可能ツール ["google-search", "web-fetch"]
    expertise JSON NOT NULL DEFAULT '[]',       -- 専門分野 ["法律", "医療", "技術"]
    restrictions JSON NOT NULL DEFAULT '[]',    -- 制限事項 ["外部API不可", "機密情報不可"]
    description TEXT,                           -- 能力説明
    is_public BOOLEAN NOT NULL DEFAULT 1,      -- 他人格から参照可能か
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (persona_id) REFERENCES contexts(id) ON DELETE CASCADE
);

-- 2. 権限管理テーブル (RBAC)
CREATE TABLE IF NOT EXISTS persona_roles (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    persona_id TEXT NOT NULL,
    role_name TEXT NOT NULL,                    -- "admin", "user", "creator", "manager"
    permissions JSON NOT NULL DEFAULT '[]',     -- ["create_persona", "edit_capabilities", "merge_personas"]
    granted_by TEXT,                           -- 付与者ID
    granted_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT,                           -- 権限有効期限
    is_active BOOLEAN NOT NULL DEFAULT 1,
    FOREIGN KEY (persona_id) REFERENCES contexts(id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES contexts(id) ON DELETE SET NULL
);

-- 3. 人格統合・生成履歴テーブル
CREATE TABLE IF NOT EXISTS persona_lineage (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    child_persona_id TEXT NOT NULL,            -- 子人格ID
    parent_persona_id TEXT,                    -- 親人格ID（NULL = システム作成）
    creation_reason TEXT,                      -- 作成理由
    merge_type TEXT,                          -- "create", "merge", "split"
    metadata JSON DEFAULT '{}',               -- 追加メタデータ
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (child_persona_id) REFERENCES contexts(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_persona_id) REFERENCES contexts(id) ON DELETE SET NULL
);

-- 4. タスク委譲履歴テーブル
CREATE TABLE IF NOT EXISTS task_delegations (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    delegator_id TEXT NOT NULL,               -- 委譲元人格
    delegatee_id TEXT NOT NULL,               -- 委譲先人格
    task_description TEXT NOT NULL,
    task_data JSON DEFAULT '{}',             -- タスクデータ
    status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'accepted', 'completed', 'failed', 'cancelled'
    result TEXT,                             -- 実行結果
    error_message TEXT,                      -- エラーメッセージ
    priority INTEGER DEFAULT 5,             -- 優先度 (1-10)
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    accepted_at TEXT,
    completed_at TEXT,
    FOREIGN KEY (delegator_id) REFERENCES contexts(id) ON DELETE CASCADE,
    FOREIGN KEY (delegatee_id) REFERENCES contexts(id) ON DELETE CASCADE
);

-- 5. 人格統合操作の監査ログテーブル
CREATE TABLE IF NOT EXISTS persona_merge_audit (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    primary_persona_id TEXT NOT NULL,         -- 主人格ID
    secondary_persona_ids JSON NOT NULL,      -- 統合された人格ID配列
    merge_strategy JSON NOT NULL,            -- 統合戦略
    capability_changes JSON DEFAULT '{}',     -- 能力変更差分
    permission_changes JSON DEFAULT '{}',     -- 権限変更差分
    history_access_granted JSON DEFAULT '[]', -- 付与された履歴アクセス権
    operator_id TEXT,                        -- 操作者ID
    operation_hash TEXT NOT NULL,            -- 改ざん検知用ハッシュ
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (primary_persona_id) REFERENCES contexts(id) ON DELETE CASCADE,
    FOREIGN KEY (operator_id) REFERENCES contexts(id) ON DELETE SET NULL
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_persona_capabilities_persona_id ON persona_capabilities(persona_id);
CREATE INDEX IF NOT EXISTS idx_persona_capabilities_public ON persona_capabilities(is_public);
CREATE INDEX IF NOT EXISTS idx_persona_capabilities_updated_at ON persona_capabilities(updated_at);

CREATE INDEX IF NOT EXISTS idx_persona_roles_persona_id ON persona_roles(persona_id);
CREATE INDEX IF NOT EXISTS idx_persona_roles_role_name ON persona_roles(role_name);
CREATE INDEX IF NOT EXISTS idx_persona_roles_active ON persona_roles(is_active);

CREATE INDEX IF NOT EXISTS idx_persona_lineage_child ON persona_lineage(child_persona_id);
CREATE INDEX IF NOT EXISTS idx_persona_lineage_parent ON persona_lineage(parent_persona_id);
CREATE INDEX IF NOT EXISTS idx_persona_lineage_type ON persona_lineage(merge_type);

CREATE INDEX IF NOT EXISTS idx_task_delegations_delegator ON task_delegations(delegator_id);
CREATE INDEX IF NOT EXISTS idx_task_delegations_delegatee ON task_delegations(delegatee_id);
CREATE INDEX IF NOT EXISTS idx_task_delegations_status ON task_delegations(status);
CREATE INDEX IF NOT EXISTS idx_task_delegations_priority ON task_delegations(priority);

CREATE INDEX IF NOT EXISTS idx_persona_merge_audit_primary ON persona_merge_audit(primary_persona_id);
CREATE INDEX IF NOT EXISTS idx_persona_merge_audit_operator ON persona_merge_audit(operator_id);
CREATE INDEX IF NOT EXISTS idx_persona_merge_audit_created_at ON persona_merge_audit(created_at);

-- 初期データ: システム管理者権限の設定
-- 既存の最初のコンテキストに管理者権限を付与
INSERT OR IGNORE INTO persona_roles (persona_id, role_name, permissions, granted_by)
SELECT 
    id,
    'admin',
    '["create_persona", "edit_capabilities", "merge_personas", "manage_roles", "view_audit"]',
    NULL
FROM contexts 
WHERE id = (SELECT id FROM contexts ORDER BY created_at LIMIT 1);
