/**
 * Phase 2: RBAC Engine - 権限継承計算システム
 * 階層構造に基づく動的権限計算とキャッシュ管理
 */

import Database from 'better-sqlite3';
import { z } from 'zod';

// 型定義
export interface Permission {
  action: string;
  resource: string;
  conditions?: Record<string, any>;
}

export interface PersonaRole {
  role_id: string;
  context_id: string;
  role_type: 'admin' | 'specialist' | 'assistant' | 'observer' | 'guest';
  permissions: Permission[];
  inherited_permissions: Permission[];
  hierarchy_level: number;
  is_active: boolean;
}

export interface HierarchyNode {
  context_id: string;
  parent_id?: string;
  children: string[];
  depth: number;
  ancestors: string[];
  descendants: string[];
}

export interface EffectivePermissions {
  context_id: string;
  direct_permissions: Permission[];
  inherited_permissions: Permission[];
  effective_permissions: Permission[];
  effective_tools: string[];
  effective_memory_scope: string;
  computed_at: Date;
  cache_version: number;
}

// Zod バリデーションスキーマ
const PermissionSchema = z.object({
  action: z.string().min(1),
  resource: z.string().min(1),
  conditions: z.record(z.any()).optional()
});

const HierarchyRelationSchema = z.object({
  parent_id: z.string().min(1),
  child_id: z.string().min(1),
  depth: z.number().min(1),
  permissions_to_inherit: z.array(PermissionSchema).optional()
});

export class RBACEngine {
  private db: Database.Database;
  private permissionCache: Map<string, EffectivePermissions> = new Map();
  private hierarchyCache: Map<string, HierarchyNode> = new Map();
  private cacheVersion: number = 1;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.initializeEngine();
  }

  /**
   * RBAC エンジン初期化
   */
  private initializeEngine(): void {
    // WAL モード有効化（並行性向上）
    this.db.pragma('journal_mode = WAL');
    
    // 外部キー制約有効化
    this.db.pragma('foreign_keys = ON');
    
    // クエリプランナー最適化
    this.db.pragma('optimize');
    
    console.log('🚀 RBAC Engine initialized with performance optimizations');
  }

  /**
   * 階層関係を作成
   * @param parentId 親人格ID
   * @param childId 子人格ID
   * @param permissionsToInherit 継承する権限（オプション）
   */
  async createHierarchyRelation(
    parentId: string, 
    childId: string, 
    permissionsToInherit?: Permission[]
  ): Promise<boolean> {
    try {
      // バリデーション
      const relation = HierarchyRelationSchema.parse({
        parent_id: parentId,
        child_id: childId,
        permissions_to_inherit: permissionsToInherit
      });

      // 循環参照チェック
      if (await this.wouldCreateCycle(parentId, childId)) {
        throw new Error(`Circular hierarchy detected: ${parentId} -> ${childId}`);
      }

      // トランザクション開始
      const transaction = this.db.transaction(() => {
        // 1. 既存の階層関係を削除（再構築のため）
        this.removeDirectHierarchyRelation(childId);

        // 2. 新しい直接関係を挿入
        this.insertDirectHierarchy(parentId, childId);

        // 3. Closure Table の更新（全ての祖先-子孫関係）
        this.updateClosureTable(parentId, childId);

        // 4. 継承権限の計算と更新
        if (permissionsToInherit) {
          this.updateInheritedPermissions(childId, permissionsToInherit);
        } else {
          this.computeAndUpdateInheritedPermissions(childId);
        }

        // 5. 影響を受ける子孫の権限再計算
        this.recomputeDescendantPermissions(childId);
      });

      transaction();

      // キャッシュ無効化
      this.invalidateCache(childId);
      
      console.log(`✅ Hierarchy relation created: ${parentId} -> ${childId}`);
      return true;

    } catch (error) {
      console.error('❌ Failed to create hierarchy relation:', error);
      throw error;
    }
  }

  /**
   * 循環参照チェック
   */
  private async wouldCreateCycle(parentId: string, childId: string): Promise<boolean> {
    // childId が parentId の祖先になっているかチェック
    const ancestorsOfParent = this.db.prepare(`
      SELECT ancestor_id FROM persona_hierarchy 
      WHERE descendant_id = ? AND depth > 0
    `).all(parentId) as Array<{ ancestor_id: string }>;

    return ancestorsOfParent.some(row => row.ancestor_id === childId);
  }

  /**
   * 直接階層関係の削除
   */
  private removeDirectHierarchyRelation(childId: string): void {
    this.db.prepare(`
      DELETE FROM persona_hierarchy 
      WHERE descendant_id = ? AND is_direct = TRUE
    `).run(childId);
  }

  /**
   * 直接階層関係の挿入
   */
  private insertDirectHierarchy(parentId: string, childId: string): void {
    this.db.prepare(`
      INSERT INTO persona_hierarchy (ancestor_id, descendant_id, depth, is_direct)
      VALUES (?, ?, 1, TRUE)
    `).run(parentId, childId);
  }

  /**
   * Closure Table の更新
   */
  private updateClosureTable(parentId: string, childId: string): void {
    // 親の全祖先 + 親自身 -> 子の全子孫 + 子自身 の関係を追加
    this.db.prepare(`
      INSERT INTO persona_hierarchy (ancestor_id, descendant_id, depth, is_direct)
      SELECT p.ancestor_id, c.descendant_id, p.depth + c.depth + 1, FALSE
      FROM persona_hierarchy p
      CROSS JOIN persona_hierarchy c
      WHERE p.descendant_id = ? AND c.ancestor_id = ?
      AND NOT EXISTS (
        SELECT 1 FROM persona_hierarchy 
        WHERE ancestor_id = p.ancestor_id AND descendant_id = c.descendant_id
      )
    `).run(parentId, childId);
  }

  /**
   * 継承権限の更新
   */
  private updateInheritedPermissions(contextId: string, permissions: Permission[]): void {
    const permissionsJson = JSON.stringify(permissions);
    
    this.db.prepare(`
      UPDATE persona_roles 
      SET inherited_permissions = ?, updated_at = CURRENT_TIMESTAMP
      WHERE context_id = ?
    `).run(permissionsJson, contextId);
  }

  /**
   * 継承権限の自動計算と更新
   */
  private computeAndUpdateInheritedPermissions(contextId: string): void {
    // 祖先から権限を収集
    const ancestorPermissions = this.db.prepare(`
      SELECT DISTINCT pr.permissions, pr.inherited_permissions, ph.depth
      FROM persona_hierarchy ph
      JOIN persona_roles pr ON ph.ancestor_id = pr.context_id
      WHERE ph.descendant_id = ? AND ph.depth > 0 AND pr.is_active = TRUE
      ORDER BY ph.depth ASC
    `).all(contextId) as Array<{
      permissions: string;
      inherited_permissions: string;
      depth: number;
    }>;

    // 権限のマージとルール適用
    const inheritedPermissions = this.mergePermissions(ancestorPermissions);
    this.updateInheritedPermissions(contextId, inheritedPermissions);
  }

  /**
   * 権限のマージ処理
   */
  private mergePermissions(ancestorData: Array<{
    permissions: string;
    inherited_permissions: string;
    depth: number;
  }>): Permission[] {
    const allPermissions = new Map<string, Permission>();

    for (const ancestor of ancestorData) {
      // 直接権限の追加
      const directPerms: Permission[] = JSON.parse(ancestor.permissions || '[]');
      for (const perm of directPerms) {
        const key = `${perm.action}:${perm.resource}`;
        allPermissions.set(key, perm);
      }

      // 継承権限の追加
      const inheritedPerms: Permission[] = JSON.parse(ancestor.inherited_permissions || '[]');
      for (const perm of inheritedPerms) {
        const key = `${perm.action}:${perm.resource}`;
        if (!allPermissions.has(key)) { // 直接権限が優先
          allPermissions.set(key, perm);
        }
      }
    }

    return Array.from(allPermissions.values());
  }

  /**
   * 子孫の権限再計算
   */
  private recomputeDescendantPermissions(contextId: string): void {
    const descendants = this.db.prepare(`
      SELECT descendant_id FROM persona_hierarchy 
      WHERE ancestor_id = ? AND depth > 0
      ORDER BY depth ASC
    `).all(contextId) as Array<{ descendant_id: string }>;

    for (const desc of descendants) {
      this.computeAndUpdateInheritedPermissions(desc.descendant_id);
    }
  }

  /**
   * 有効権限の計算（キャッシュ含む）
   */
  async getEffectivePermissions(contextId: string, useCache: boolean = true): Promise<EffectivePermissions> {
    // キャッシュチェック
    if (useCache && this.permissionCache.has(contextId)) {
      const cached = this.permissionCache.get(contextId)!;
      
      // キャッシュの有効性確認
      if (this.isCacheValid(cached)) {
        return cached;
      }
    }

    // 権限計算
    const effectivePerms = await this.computeEffectivePermissions(contextId);
    
    // キャッシュ更新
    this.permissionCache.set(contextId, effectivePerms);
    this.updatePermissionCache(effectivePerms);

    return effectivePerms;
  }

  /**
   * 有効権限の実際の計算
   */
  private async computeEffectivePermissions(contextId: string): Promise<EffectivePermissions> {
    // 直接権限取得
    const roleData = this.db.prepare(`
      SELECT permissions, inherited_permissions FROM persona_roles 
      WHERE context_id = ? AND is_active = TRUE
    `).get(contextId) as { permissions: string; inherited_permissions: string } | undefined;

    if (!roleData) {
      throw new Error(`No active role found for context: ${contextId}`);
    }

    const directPermissions: Permission[] = JSON.parse(roleData.permissions || '[]');
    const inheritedPermissions: Permission[] = JSON.parse(roleData.inherited_permissions || '[]');

    // 有効権限のマージ（直接権限が優先）
    const effectiveMap = new Map<string, Permission>();
    
    // 継承権限を先に追加
    for (const perm of inheritedPermissions) {
      const key = `${perm.action}:${perm.resource}`;
      effectiveMap.set(key, perm);
    }

    // 直接権限で上書き
    for (const perm of directPermissions) {
      const key = `${perm.action}:${perm.resource}`;
      effectiveMap.set(key, perm);
    }

    const effectivePermissions = Array.from(effectiveMap.values());

    // ツール権限とメモリスコープの計算
    const effectiveTools = this.extractToolPermissions(effectivePermissions);
    const effectiveMemoryScope = this.computeMemoryScope(effectivePermissions);

    return {
      context_id: contextId,
      direct_permissions: directPermissions,
      inherited_permissions: inheritedPermissions,
      effective_permissions: effectivePermissions,
      effective_tools: effectiveTools,
      effective_memory_scope: effectiveMemoryScope,
      computed_at: new Date(),
      cache_version: this.cacheVersion
    };
  }

  /**
   * ツール権限の抽出
   */
  private extractToolPermissions(permissions: Permission[]): string[] {
    return permissions
      .filter(p => p.resource === 'tool' || p.resource.startsWith('tool:'))
      .map(p => p.resource.replace('tool:', ''))
      .filter(tool => tool !== 'tool');
  }

  /**
   * メモリスコープの計算
   */
  private computeMemoryScope(permissions: Permission[]): string {
    const memoryPerms = permissions.filter(p => p.resource === 'memory' || p.resource.startsWith('memory:'));
    
    if (memoryPerms.some(p => p.action === 'admin')) {
      return '*'; // 全スコープアクセス
    }

    const scopes = memoryPerms
      .map(p => p.conditions?.scope)
      .filter(Boolean);

    return scopes.length > 0 ? scopes.join(',') : '';
  }

  /**
   * キャッシュ有効性チェック
   */
  private isCacheValid(cached: EffectivePermissions): boolean {
    const cacheAge = Date.now() - cached.computed_at.getTime();
    const maxAge = 5 * 60 * 1000; // 5分

    return cacheAge < maxAge && cached.cache_version === this.cacheVersion;
  }

  /**
   * データベースキャッシュテーブルの更新
   */
  private updatePermissionCache(effectivePerms: EffectivePermissions): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO persona_permission_cache 
      (context_id, effective_permissions, effective_tools, effective_memory_scope, last_computed, is_valid)
      VALUES (?, ?, ?, ?, ?, TRUE)
    `).run(
      effectivePerms.context_id,
      JSON.stringify(effectivePerms.effective_permissions),
      JSON.stringify(effectivePerms.effective_tools),
      effectivePerms.effective_memory_scope,
      effectivePerms.computed_at.toISOString()
    );
  }

  /**
   * キャッシュ無効化
   */
  private invalidateCache(contextId: string): void {
    // メモリキャッシュクリア
    this.permissionCache.delete(contextId);
    
    // データベースキャッシュ無効化
    this.db.prepare(`
      UPDATE persona_permission_cache 
      SET is_valid = FALSE 
      WHERE context_id = ?
    `).run(contextId);

    // 影響を受ける子孫のキャッシュも無効化
    const descendants = this.db.prepare(`
      SELECT descendant_id FROM persona_hierarchy 
      WHERE ancestor_id = ? AND depth > 0
    `).all(contextId) as Array<{ descendant_id: string }>;

    for (const desc of descendants) {
      this.permissionCache.delete(desc.descendant_id);
      this.db.prepare(`
        UPDATE persona_permission_cache 
        SET is_valid = FALSE 
        WHERE context_id = ?
      `).run(desc.descendant_id);
    }

    this.cacheVersion++;
  }

  /**
   * 権限チェック
   */
  async hasPermission(
    contextId: string, 
    action: string, 
    resource: string, 
    conditions?: Record<string, any>
  ): Promise<boolean> {
    try {
      const effectivePerms = await this.getEffectivePermissions(contextId);
      
      return effectivePerms.effective_permissions.some((perm: Permission) => {
        if (perm.action !== action || perm.resource !== resource) {
          return false;
        }

        // 条件チェック
        if (conditions && perm.conditions) {
          for (const [key, value] of Object.entries(conditions)) {
            if (perm.conditions[key] !== value) {
              return false;
            }
          }
        }

        return true;
      });
    } catch (error) {
      console.error(`Permission check failed for ${contextId}:`, error);
      return false;
    }
  }

  /**
   * 階層構造の取得
   */
  getHierarchyTree(rootContextId?: string): HierarchyNode[] {
    const query = rootContextId 
      ? `SELECT * FROM persona_hierarchy WHERE ancestor_id = ? OR ancestor_id IN (
          SELECT descendant_id FROM persona_hierarchy WHERE ancestor_id = ?
        )`
      : `SELECT * FROM persona_hierarchy`;

    const hierarchyData = this.db.prepare(query).all(
      ...(rootContextId ? [rootContextId, rootContextId] : [])
    ) as Array<{
      ancestor_id: string;
      descendant_id: string;
      depth: number;
      is_direct: boolean;
    }>;

    // 階層ツリー構築
    const nodes = new Map<string, HierarchyNode>();
    
    // ノード初期化
    const allContextIds = new Set<string>();
    hierarchyData.forEach(row => {
      allContextIds.add(row.ancestor_id);
      allContextIds.add(row.descendant_id);
    });

    allContextIds.forEach(contextId => {
      if (!nodes.has(contextId)) {
        nodes.set(contextId, {
          context_id: contextId,
          children: [],
          depth: 0,
          ancestors: [],
          descendants: []
        });
      }
    });

    // 関係構築
    hierarchyData.forEach(row => {
      const ancestor = nodes.get(row.ancestor_id)!;
      const descendant = nodes.get(row.descendant_id)!;

      if (row.is_direct) {
        ancestor.children.push(row.descendant_id);
        descendant.parent_id = row.ancestor_id;
        descendant.depth = row.depth;
      }

      if (row.depth > 0) {
        descendant.ancestors.push(row.ancestor_id);
        ancestor.descendants.push(row.descendant_id);
      }
    });

    return Array.from(nodes.values());
  }

  /**
   * エンジンクリーンアップ
   */
  dispose(): void {
    this.permissionCache.clear();
    this.hierarchyCache.clear();
    this.db.close();
    console.log('🛑 RBAC Engine disposed');
  }
}
