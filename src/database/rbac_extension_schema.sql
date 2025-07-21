-- Phase 1: RBAC システム用データベース拡張
-- persona_hierarchy テーブル (Closure Table方式) と inherited_permissions 追加

-- 1. 階層関係管理テーブル (Closure Table方式)
CREATE TABLE IF NOT EXISTS persona_hierarchy (
    ancestor_id TEXT NOT NULL,      -- 祖先人格ID
    descendant_id TEXT NOT NULL,    -- 子孫人格ID
    depth INTEGER NOT NULL,         -- 階層の深さ (0=自分自身, 1=直接の子, 2=孫...)
    is_direct BOOLEAN DEFAULT FALSE, -- 直接の親子関係かどうか
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (ancestor_id, descendant_id),
    FOREIGN KEY (ancestor_id) REFERENCES contexts(context_id) ON DELETE CASCADE,
    FOREIGN KEY (descendant_id) REFERENCES contexts(context_id) ON DELETE CASCADE,
    CHECK (depth >= 0) -- 階層の深さは非負値
);

-- 2. persona_roles テーブルに inherited_permissions カラム追加
ALTER TABLE persona_roles 
ADD COLUMN inherited_permissions TEXT DEFAULT '[]'; -- JSON array of inherited permissions

-- 3. 権限継承キャッシュテーブル (パフォーマンス最適化用)
CREATE TABLE IF NOT EXISTS persona_permission_cache (
    context_id TEXT PRIMARY KEY,
    effective_permissions TEXT NOT NULL DEFAULT '[]', -- JSON: 自身+継承された権限の統合
    effective_tools TEXT NOT NULL DEFAULT '[]',       -- JSON: 自身+継承されたツールの統合  
    effective_memory_scope TEXT DEFAULT '',            -- 有効なメモリアクセス範囲
    last_computed DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_valid BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (context_id) REFERENCES contexts(context_id) ON DELETE CASCADE
);

-- インデックス作成 (パフォーマンス最適化)
CREATE INDEX IF NOT EXISTS idx_persona_hierarchy_ancestor ON persona_hierarchy(ancestor_id);
CREATE INDEX IF NOT EXISTS idx_persona_hierarchy_descendant ON persona_hierarchy(descendant_id);
CREATE INDEX IF NOT EXISTS idx_persona_hierarchy_depth ON persona_hierarchy(depth);
CREATE INDEX IF NOT EXISTS idx_persona_hierarchy_direct ON persona_hierarchy(is_direct) WHERE is_direct = TRUE;

CREATE INDEX IF NOT EXISTS idx_permission_cache_valid ON persona_permission_cache(is_valid) WHERE is_valid = TRUE;
CREATE INDEX IF NOT EXISTS idx_permission_cache_computed ON persona_permission_cache(last_computed);

-- ビュー: 階層構造の可視化
CREATE VIEW IF NOT EXISTS persona_hierarchy_tree AS
WITH RECURSIVE hierarchy_tree AS (
    -- ルートノード (親を持たない人格)
    SELECT 
        ph.descendant_id as context_id,
        ph.ancestor_id as parent_id,
        ph.depth,
        ph.descendant_id as root_id,
        0 as level,
        ph.descendant_id as path
    FROM persona_hierarchy ph
    WHERE ph.depth = 1
    AND ph.ancestor_id NOT IN (
        SELECT DISTINCT descendant_id 
        FROM persona_hierarchy 
        WHERE depth = 1
    )
    
    UNION ALL
    
    -- 子ノード
    SELECT 
        ph.descendant_id as context_id,
        ph.ancestor_id as parent_id,
        ph.depth,
        ht.root_id,
        ht.level + 1,
        ht.path || ' -> ' || ph.descendant_id
    FROM persona_hierarchy ph
    JOIN hierarchy_tree ht ON ph.ancestor_id = ht.context_id
    WHERE ph.depth = 1
)
SELECT 
    context_id,
    parent_id,
    root_id,
    level,
    path,
    (SELECT COUNT(*) FROM persona_hierarchy WHERE ancestor_id = ht.context_id AND depth = 1) as children_count
FROM hierarchy_tree ht
ORDER BY root_id, level, context_id;

-- ビュー: 有効権限の統合ビュー
CREATE VIEW IF NOT EXISTS persona_effective_permissions AS
SELECT 
    pr.context_id,
    pr.role_type,
    pr.permissions as direct_permissions,
    pr.inherited_permissions,
    COALESCE(ppc.effective_permissions, '[]') as effective_permissions,
    COALESCE(ppc.effective_tools, '[]') as effective_tools,
    COALESCE(ppc.effective_memory_scope, '') as effective_memory_scope,
    pr.hierarchy_level,
    pr.is_active,
    ppc.last_computed,
    ppc.is_valid as cache_valid
FROM persona_roles pr
LEFT JOIN persona_permission_cache ppc ON pr.context_id = ppc.context_id
WHERE pr.is_active = 1;

-- トリガー: 階層変更時のキャッシュ無効化
CREATE TRIGGER IF NOT EXISTS invalidate_permission_cache_on_hierarchy_change
    AFTER INSERT ON persona_hierarchy
    FOR EACH ROW
    BEGIN
        -- 影響を受ける全ての子孫のキャッシュを無効化
        UPDATE persona_permission_cache 
        SET is_valid = FALSE, last_computed = CURRENT_TIMESTAMP
        WHERE context_id IN (
            SELECT descendant_id 
            FROM persona_hierarchy 
            WHERE ancestor_id = NEW.descendant_id
        );
        
        -- 新しく追加されたノード自体のキャッシュも無効化
        UPDATE persona_permission_cache 
        SET is_valid = FALSE, last_computed = CURRENT_TIMESTAMP
        WHERE context_id = NEW.descendant_id;
    END;

-- トリガー: 権限変更時のキャッシュ無効化
CREATE TRIGGER IF NOT EXISTS invalidate_permission_cache_on_permission_change
    AFTER UPDATE OF permissions, inherited_permissions ON persona_roles
    FOR EACH ROW
    BEGIN
        -- 変更されたノードとその全ての子孫のキャッシュを無効化
        UPDATE persona_permission_cache 
        SET is_valid = FALSE, last_computed = CURRENT_TIMESTAMP
        WHERE context_id IN (
            SELECT descendant_id 
            FROM persona_hierarchy 
            WHERE ancestor_id = NEW.context_id
            UNION
            SELECT NEW.context_id
        );
    END;

-- トリガー: persona_hierarchy の updated_at 更新
CREATE TRIGGER IF NOT EXISTS update_persona_hierarchy_timestamp 
    AFTER UPDATE ON persona_hierarchy
    FOR EACH ROW
    BEGIN
        UPDATE persona_hierarchy SET updated_at = CURRENT_TIMESTAMP 
        WHERE ancestor_id = NEW.ancestor_id AND descendant_id = NEW.descendant_id;
    END;
