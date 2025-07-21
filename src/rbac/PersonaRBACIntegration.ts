/**
 * Phase 2: PersonaManager RBAC統合拡張
 * 既存のPersonaManagerにRBAC機能を統合
 */

import { PersonaManager } from '../utils/personaManager.js';
import { RBACMCPTools } from '../rbac/RBACMCPTools.js';
import { Permission } from '../rbac/RBACEngine.js';

export interface RBACPersonaManager extends PersonaManager {
  // RBAC拡張機能
  createPersonaHierarchy(parentContextId: string, childContextId: string, permissions?: Permission[]): Promise<boolean>;
  getPersonaPermissions(contextId: string, includeHierarchy?: boolean): Promise<any>;
  checkPersonaPermission(contextId: string, action: string, resource: string, conditions?: Record<string, any>): Promise<boolean>;
  updatePersonaPermissions(contextId: string, permissionsToAdd?: Permission[], permissionsToRemove?: Permission[]): Promise<boolean>;
  getPersonaHierarchyTree(rootContextId?: string): Promise<any>;
  getPersonaSelfCapabilities(contextId: string): Promise<any>;
  
  // クリーンアップメソッド
  cleanup?(): void;
}

/**
 * PersonaManagerのRBAC拡張ファクトリ
 */
export function createRBACPersonaManager(personaManager: PersonaManager, dbPath: string): RBACPersonaManager {
  const rbacTools = new RBACMCPTools(dbPath);

  // PersonaManagerオブジェクトを拡張
  const rbacPersonaManager = personaManager as RBACPersonaManager;

  /**
   * 人格階層の作成
   */
  rbacPersonaManager.createPersonaHierarchy = async function(
    parentContextId: string, 
    childContextId: string, 
    permissions?: Permission[]
  ): Promise<boolean> {
    try {
      const result = await rbacTools.createHierarchy({
        parent_context_id: parentContextId,
        child_context_id: childContextId,
        permissions_to_inherit: permissions
      });

      const response = JSON.parse(result.content[0].text);
      return response.success && response.result.hierarchy_created;
    } catch (error) {
      console.error('❌ Failed to create persona hierarchy:', error);
      return false;
    }
  };

  /**
   * 人格権限の取得
   */
  rbacPersonaManager.getPersonaPermissions = async function(
    contextId: string, 
    includeHierarchy: boolean = false
  ): Promise<any> {
    try {
      const result = await rbacTools.getPermissions({
        context_id: contextId,
        include_hierarchy: includeHierarchy,
        use_cache: true
      });

      const response = JSON.parse(result.content[0].text);
      return response.success ? response.result : null;
    } catch (error) {
      console.error(`❌ Failed to get persona permissions for ${contextId}:`, error);
      return null;
    }
  };

  /**
   * 人格権限チェック
   */
  rbacPersonaManager.checkPersonaPermission = async function(
    contextId: string, 
    action: string, 
    resource: string, 
    conditions?: Record<string, any>
  ): Promise<boolean> {
    try {
      const result = await rbacTools.checkPermission({
        context_id: contextId,
        action: action,
        resource: resource,
        conditions: conditions
      });

      const response = JSON.parse(result.content[0].text);
      return response.success && response.result.permission_check.granted;
    } catch (error) {
      console.error(`❌ Permission check failed for ${contextId}:`, error);
      return false;
    }
  };

  /**
   * 人格権限の更新
   */
  rbacPersonaManager.updatePersonaPermissions = async function(
    contextId: string, 
    permissionsToAdd?: Permission[], 
    permissionsToRemove?: Permission[]
  ): Promise<boolean> {
    try {
      const result = await rbacTools.updatePermissions({
        context_id: contextId,
        permissions_to_add: permissionsToAdd,
        permissions_to_remove: permissionsToRemove,
        recalculate_inheritance: true
      });

      const response = JSON.parse(result.content[0].text);
      return response.success;
    } catch (error) {
      console.error(`❌ Failed to update persona permissions for ${contextId}:`, error);
      return false;
    }
  };

  /**
   * 人格階層ツリーの取得
   */
  rbacPersonaManager.getPersonaHierarchyTree = async function(rootContextId?: string): Promise<any> {
    try {
      const result = await rbacTools.getHierarchyTree({
        root_context_id: rootContextId,
        include_permissions: true
      });

      const response = JSON.parse(result.content[0].text);
      return response.success ? response.result : null;
    } catch (error) {
      console.error('❌ Failed to get persona hierarchy tree:', error);
      return null;
    }
  };

  /**
   * 人格の自己能力認識
   */
  rbacPersonaManager.getPersonaSelfCapabilities = async function(contextId: string): Promise<any> {
    try {
      const result = await rbacTools.getSelfCapabilities({
        context_id: contextId,
        include_tools: true,
        include_memory_scope: true,
        include_hierarchy_position: true
      });

      const response = JSON.parse(result.content[0].text);
      return response.success ? response.result : null;
    } catch (error) {
      console.error(`❌ Failed to get self capabilities for ${contextId}:`, error);
      return null;
    }
  };

  // クリーンアップメソッドの拡張
  const originalCleanup = rbacPersonaManager.cleanup?.bind(rbacPersonaManager);
  rbacPersonaManager.cleanup = function() {
    if (originalCleanup) {
      originalCleanup();
    }
    rbacTools.dispose();
    console.log('🛑 RBAC PersonaManager cleaned up');
  };

  console.log('🔧 PersonaManager extended with RBAC capabilities');
  return rbacPersonaManager;
}

/**
 * PersonaManager向けRBACヘルパー関数
 */
export class PersonaRBACHelper {
  /**
   * 基本的な権限セットの作成
   */
  static createBasicPermissions(role: 'admin' | 'specialist' | 'assistant' | 'observer' | 'guest'): Permission[] {
    const basePermissions: Permission[] = [];

    switch (role) {
      case 'admin':
        basePermissions.push(
          { action: 'admin', resource: 'memory' },
          { action: 'admin', resource: 'tool' },
          { action: 'admin', resource: 'persona' },
          { action: 'create', resource: 'hierarchy' },
          { action: 'manage', resource: 'permissions' }
        );
        break;

      case 'specialist':
        basePermissions.push(
          { action: 'read', resource: 'memory', conditions: { scope: 'work,learning' } },
          { action: 'write', resource: 'memory', conditions: { scope: 'work' } },
          { action: 'execute', resource: 'tool', conditions: { category: 'analysis,search' } },
          { action: 'read', resource: 'persona' }
        );
        break;

      case 'assistant':
        basePermissions.push(
          { action: 'read', resource: 'memory', conditions: { scope: 'personal,work' } },
          { action: 'write', resource: 'memory', conditions: { scope: 'personal' } },
          { action: 'execute', resource: 'tool', conditions: { category: 'basic,search' } }
        );
        break;

      case 'observer':
        basePermissions.push(
          { action: 'read', resource: 'memory', conditions: { scope: 'public' } },
          { action: 'read', resource: 'persona' }
        );
        break;

      case 'guest':
        basePermissions.push(
          { action: 'read', resource: 'memory', conditions: { scope: 'public', content_type: 'basic' } }
        );
        break;
    }

    return basePermissions;
  }

  /**
   * ツール権限の作成
   */
  static createToolPermissions(tools: string[]): Permission[] {
    return tools.map(tool => ({
      action: 'execute',
      resource: `tool:${tool}`
    }));
  }

  /**
   * メモリスコープ権限の作成
   */
  static createMemoryPermissions(scopes: string[], actions: ('read' | 'write' | 'admin')[]): Permission[] {
    const permissions: Permission[] = [];
    
    for (const action of actions) {
      for (const scope of scopes) {
        permissions.push({
          action: action,
          resource: 'memory',
          conditions: { scope: scope }
        });
      }
    }

    return permissions;
  }

  /**
   * 階層構造の推奨パターン
   */
  static getRecommendedHierarchy(): {
    pattern: string;
    description: string;
    example: { parent: string; children: string[]; permissions: Permission[] };
  }[] {
    return [
      {
        pattern: 'Admin -> Specialists',
        description: 'Administrative persona managing specialist personas',
        example: {
          parent: 'system-admin',
          children: ['data-scientist', 'security-analyst'],
          permissions: PersonaRBACHelper.createBasicPermissions('specialist')
        }
      },
      {
        pattern: 'Specialist -> Assistants',
        description: 'Specialist persona with assistant personas for specific tasks',
        example: {
          parent: 'data-scientist',
          children: ['analysis-assistant', 'visualization-assistant'],
          permissions: PersonaRBACHelper.createBasicPermissions('assistant')
        }
      },
      {
        pattern: 'Project Team',
        description: 'Project manager with team members',
        example: {
          parent: 'project-manager',
          children: ['developer', 'tester', 'documenter'],
          permissions: [
            { action: 'read', resource: 'memory', conditions: { scope: 'project' } },
            { action: 'write', resource: 'memory', conditions: { scope: 'project', role: 'team' } }
          ]
        }
      }
    ];
  }

  /**
   * 権限継承ルールの検証
   */
  static validatePermissionInheritance(
    parentPermissions: Permission[], 
    childPermissions: Permission[]
  ): { valid: boolean; conflicts: string[]; recommendations: string[] } {
    const conflicts: string[] = [];
    const recommendations: string[] = [];

    // 権限の競合チェック
    for (const childPerm of childPermissions) {
      const conflictingParent = parentPermissions.find(p => 
        p.action === childPerm.action && 
        p.resource === childPerm.resource &&
        JSON.stringify(p.conditions) !== JSON.stringify(childPerm.conditions)
      );

      if (conflictingParent) {
        conflicts.push(`Permission conflict: ${childPerm.action}:${childPerm.resource} has different conditions`);
      }
    }

    // 推奨事項の生成
    if (parentPermissions.some(p => p.action === 'admin')) {
      recommendations.push('Parent has admin permissions - consider limiting child permissions for security');
    }

    if (childPermissions.length > parentPermissions.length * 1.5) {
      recommendations.push('Child has significantly more permissions than parent - verify inheritance logic');
    }

    return {
      valid: conflicts.length === 0,
      conflicts: conflicts,
      recommendations: recommendations
    };
  }
}

/**
 * RBAC統合のスキーマ検証
 */
export function validateRBACIntegration(personaManager: any): boolean {
  const requiredMethods = [
    'createPersonaHierarchy',
    'getPersonaPermissions', 
    'checkPersonaPermission',
    'updatePersonaPermissions',
    'getPersonaHierarchyTree',
    'getPersonaSelfCapabilities'
  ];

  for (const method of requiredMethods) {
    if (typeof personaManager[method] !== 'function') {
      console.error(`❌ RBAC integration validation failed: missing method ${method}`);
      return false;
    }
  }

  console.log('✅ RBAC integration validation passed');
  return true;
}
