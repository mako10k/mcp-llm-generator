-- Sprint4 Phase 1: データベーススキーマ作成
-- ペルソナ管理統合システム用テーブル

-- 0. コンテキストテーブル（依存テーブル）
CREATE TABLE IF NOT EXISTS contexts (
    context_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 1. ペルソナ能力テーブル（既存機能強化）
CREATE TABLE IF NOT EXISTS persona_capabilities (
    context_id TEXT PRIMARY KEY,
    expertise TEXT NOT NULL DEFAULT '[]',
    tools TEXT NOT NULL DEFAULT '[]', 
    restrictions TEXT NOT NULL DEFAULT '[]',
    performance_metrics TEXT,
    learning_capabilities TEXT,
    is_public BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (context_id) REFERENCES contexts(context_id) ON DELETE CASCADE
);

-- 2. ペルソナロール・権限管理テーブル（新規）
CREATE TABLE IF NOT EXISTS persona_roles (
    role_id TEXT PRIMARY KEY,
    context_id TEXT NOT NULL,
    role_type TEXT NOT NULL CHECK (role_type IN ('admin', 'specialist', 'assistant', 'observer', 'guest')),
    permissions TEXT NOT NULL DEFAULT '[]', -- JSON array of permissions
    role_description TEXT,
    parent_role_id TEXT,
    hierarchy_level INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (context_id) REFERENCES contexts(context_id) ON DELETE CASCADE,
    FOREIGN KEY (parent_role_id) REFERENCES persona_roles(role_id) ON DELETE SET NULL
);

-- 3. タスク委譲管理テーブル（新規）
CREATE TABLE IF NOT EXISTS task_delegations (
    delegation_id TEXT PRIMARY KEY,
    from_context_id TEXT NOT NULL,
    to_context_id TEXT NOT NULL,
    task_description TEXT NOT NULL,
    required_capabilities TEXT NOT NULL DEFAULT '[]', -- JSON array
    priority_level TEXT NOT NULL DEFAULT 'medium' CHECK (priority_level IN ('low', 'medium', 'high', 'urgent')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'in_progress', 'completed', 'failed', 'cancelled')),
    result_data TEXT, -- JSON for task results
    delegation_metadata TEXT, -- JSON for additional metadata
    scheduled_at DATETIME,
    started_at DATETIME,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (from_context_id) REFERENCES contexts(context_id) ON DELETE CASCADE,
    FOREIGN KEY (to_context_id) REFERENCES contexts(context_id) ON DELETE CASCADE
);

-- 4. ペルソナ統合・系譜管理テーブル（新規）
CREATE TABLE IF NOT EXISTS persona_lineage (
    lineage_id TEXT PRIMARY KEY,
    parent_context_id TEXT NOT NULL,
    child_context_id TEXT NOT NULL,
    merge_strategy TEXT NOT NULL DEFAULT 'additive' CHECK (merge_strategy IN ('additive', 'override', 'selective', 'weighted')),
    merge_rules TEXT, -- JSON rules for merging
    inheritance_percentage REAL DEFAULT 1.0 CHECK (inheritance_percentage >= 0.0 AND inheritance_percentage <= 1.0),
    merge_metadata TEXT, -- JSON metadata about merge
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_context_id) REFERENCES contexts(context_id) ON DELETE CASCADE,
    FOREIGN KEY (child_context_id) REFERENCES contexts(context_id) ON DELETE CASCADE
);

-- インデックス作成（パフォーマンス最適化）
CREATE INDEX IF NOT EXISTS idx_persona_capabilities_context ON persona_capabilities(context_id);
CREATE INDEX IF NOT EXISTS idx_persona_capabilities_public ON persona_capabilities(is_public) WHERE is_public = 1;

CREATE INDEX IF NOT EXISTS idx_persona_roles_context ON persona_roles(context_id);
CREATE INDEX IF NOT EXISTS idx_persona_roles_type ON persona_roles(role_type);
CREATE INDEX IF NOT EXISTS idx_persona_roles_hierarchy ON persona_roles(hierarchy_level);
CREATE INDEX IF NOT EXISTS idx_persona_roles_active ON persona_roles(is_active) WHERE is_active = 1;

CREATE INDEX IF NOT EXISTS idx_task_delegations_from ON task_delegations(from_context_id);
CREATE INDEX IF NOT EXISTS idx_task_delegations_to ON task_delegations(to_context_id);
CREATE INDEX IF NOT EXISTS idx_task_delegations_status ON task_delegations(status);
CREATE INDEX IF NOT EXISTS idx_task_delegations_priority ON task_delegations(priority_level);
CREATE INDEX IF NOT EXISTS idx_task_delegations_scheduled ON task_delegations(scheduled_at) WHERE scheduled_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_persona_lineage_parent ON persona_lineage(parent_context_id);
CREATE INDEX IF NOT EXISTS idx_persona_lineage_child ON persona_lineage(child_context_id);
CREATE INDEX IF NOT EXISTS idx_persona_lineage_active ON persona_lineage(is_active) WHERE is_active = 1;

-- ビューの作成（クエリ最適化）
CREATE VIEW IF NOT EXISTS persona_full_info AS
SELECT 
    pc.context_id,
    pc.expertise,
    pc.tools,
    pc.restrictions,
    pc.performance_metrics,
    pc.learning_capabilities,
    pc.is_public,
    pr.role_type,
    pr.permissions,
    pr.role_description,
    pr.hierarchy_level,
    COUNT(td_from.delegation_id) as outgoing_delegations,
    COUNT(td_to.delegation_id) as incoming_delegations,
    COUNT(pl_parent.lineage_id) as child_personas,
    COUNT(pl_child.lineage_id) as parent_personas
FROM persona_capabilities pc
LEFT JOIN persona_roles pr ON pc.context_id = pr.context_id AND pr.is_active = 1
LEFT JOIN task_delegations td_from ON pc.context_id = td_from.from_context_id AND td_from.status IN ('pending', 'in_progress')
LEFT JOIN task_delegations td_to ON pc.context_id = td_to.to_context_id AND td_to.status IN ('pending', 'in_progress')
LEFT JOIN persona_lineage pl_parent ON pc.context_id = pl_parent.parent_context_id AND pl_parent.is_active = 1
LEFT JOIN persona_lineage pl_child ON pc.context_id = pl_child.child_context_id AND pl_child.is_active = 1
GROUP BY pc.context_id, pr.role_id;

-- トリガー作成（データ整合性保証）
CREATE TRIGGER IF NOT EXISTS update_persona_capabilities_timestamp 
    AFTER UPDATE ON persona_capabilities
    FOR EACH ROW
    BEGIN
        UPDATE persona_capabilities SET updated_at = CURRENT_TIMESTAMP WHERE context_id = NEW.context_id;
    END;

CREATE TRIGGER IF NOT EXISTS update_persona_roles_timestamp 
    AFTER UPDATE ON persona_roles
    FOR EACH ROW
    BEGIN
        UPDATE persona_roles SET updated_at = CURRENT_TIMESTAMP WHERE role_id = NEW.role_id;
    END;

CREATE TRIGGER IF NOT EXISTS update_task_delegations_timestamp 
    AFTER UPDATE ON task_delegations
    FOR EACH ROW
    BEGIN
        UPDATE task_delegations SET updated_at = CURRENT_TIMESTAMP WHERE delegation_id = NEW.delegation_id;
    END;

CREATE TRIGGER IF NOT EXISTS update_persona_lineage_timestamp 
    AFTER UPDATE ON persona_lineage
    FOR EACH ROW
    BEGIN
        UPDATE persona_lineage SET updated_at = CURRENT_TIMESTAMP WHERE lineage_id = NEW.lineage_id;
    END;
