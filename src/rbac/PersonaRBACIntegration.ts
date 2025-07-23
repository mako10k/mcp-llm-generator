/**
 * Phase 2: PersonaManager RBAC統合拡張
 * 既存のPersonaManagerにRBAC機能を統合
 */

import { PersonaManager } from '../utils/personaManager.js';
import { RBACMCPTools } from '../rbac/RBACMCPTools.js';
import { Permission } from '../rbac/RBACEngine.js';
import { PersonaCapabilities, SecurityValidationResult, TaskDelegation, PromptSecurityLevel } from '../types/persona';

// 型定義を追加
interface PersonaPermissions {
  contextId: string;
  permissions: Permission[];
  hierarchy?: PersonaPermissions[];
}

interface PersonaHierarchyTree {
  contextId: string;
  children: PersonaHierarchyTree[];
  permissions: Permission[];
}

interface PersonaSelfCapabilities {
  contextId: string;
  capabilities: {
    tools: string[];
    memory_scope: string[];
    hierarchy_position: string;
  };
}

// 実行時型ガード関数
function isValidRBACResponse(response: unknown): response is { success: boolean; result: unknown } {
  return typeof response === 'object' && 
         response !== null && 
         'success' in response && 
         typeof (response as Record<string, unknown>).success === 'boolean';
}

function isValidHierarchyResult(result: unknown): result is { hierarchy_created: boolean } {
  return typeof result === 'object' && 
         result !== null && 
         'hierarchy_created' in result &&
         typeof (result as Record<string, unknown>).hierarchy_created === 'boolean';
}

// JSON解析のユーティリティ関数
function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Failed to parse JSON response: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function isValidPermissionCheckResult(result: unknown): result is { permitted: boolean } {
  return typeof result === 'object' && 
         result !== null && 
         'permitted' in result &&
         typeof (result as Record<string, unknown>).permitted === 'boolean';
}

export interface RBACPersonaManager extends PersonaManager {
  // RBAC拡張機能
  createPersonaHierarchy(parentContextId: string, childContextId: string, permissions?: Permission[]): Promise<boolean>;
  getPersonaPermissions(contextId: string, includeHierarchy?: boolean): Promise<PersonaPermissions | null>;
  checkPersonaPermission(contextId: string, action: string, resource: string, conditions?: Record<string, string | number | boolean | null>): Promise<boolean>;
  updatePersonaPermissions(contextId: string, permissionsToAdd?: Permission[], permissionsToRemove?: Permission[]): Promise<boolean>;
  getPersonaHierarchyTree(rootContextId?: string): Promise<PersonaHierarchyTree | null>;
  getPersonaSelfCapabilities(contextId: string): Promise<PersonaSelfCapabilities | null>;

  // 必須メソッド（PersonaManagerから継承）
  getPersonaCapabilities(contextId: string): PersonaCapabilities | null;
  updatePersonaCapabilities(contextId: string, capabilities: PersonaCapabilities): boolean;
  checkRolePermissions(contextId: string, requiredPermission: string): boolean;
  createTaskDelegation(delegation: Omit<TaskDelegation, 'delegation_id' | 'created_at' | 'updated_at'>): string | null;
  findSuitablePersona(requiredCapabilities: string[], excludeContextIds?: string[]): string | null;
  optimizePromptForPersona(contextId: string, basePrompt: string, options?: {
    max_tokens?: number;
    model?: string;
    security_level?: PromptSecurityLevel;
    task_context?: string;
  }): {
    optimized_prompt: string;
    security_result: SecurityValidationResult;
    token_analysis: unknown;
    applied_optimizations: string[];
  };

  // クリーンアップメソッド
  cleanup?(): void;
}

/**
 * PersonaManagerのRBAC拡張ファクトリ
 */
export function createRBACPersonaManager(personaManager: PersonaManager, dbPath: string): RBACPersonaManager {
  const rbacTools = new RBACMCPTools(dbPath);

  // PersonaManagerをベースとして、RBACメソッドを追加
  const rbacExtensions = {
    createPersonaHierarchy: async function(
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

        if (!result.content?.[0]?.text || typeof result.content[0].text !== 'string') {
          throw new Error('Invalid response content structure from createHierarchy');
        }
        const rawResponse = safeJsonParse(result.content[0].text);
        if (!isValidRBACResponse(rawResponse)) {
          throw new Error('Invalid RBAC response format');
        }
        if (!isValidHierarchyResult(rawResponse.result)) {
          throw new Error('Invalid hierarchy result format');
        }
        return rawResponse.success && rawResponse.result.hierarchy_created;
      } catch (error) {
        console.error('❌ Failed to create persona hierarchy:', error);
        return false;
      }
    },
    getPersonaPermissions: async function(
      contextId: string, 
      includeHierarchy?: boolean
    ): Promise<PersonaPermissions | null> {
      try {
        const result = await rbacTools.getPermissions({
          context_id: contextId,
          include_hierarchy: includeHierarchy || false
        });

        if (!result.content?.[0]?.text || typeof result.content[0].text !== 'string') {
          throw new Error('Invalid response content structure from getPermissions');
        }
        const rawResponse = safeJsonParse(result.content[0].text);
        if (!isValidRBACResponse(rawResponse)) {
          throw new Error('Invalid RBAC response format');
        }
        return rawResponse.result as PersonaPermissions;
      } catch (error) {
        console.error('❌ Failed to get persona permissions:', error);
        return null;
      }
    },
    checkPersonaPermission: async function(
      contextId: string, 
      action: string, 
      resource: string, 
      conditions?: Record<string, string | number | boolean | null>
    ): Promise<boolean> {
      try {
        const result = await rbacTools.checkPermission({
          context_id: contextId,
          action: action,
          resource: resource,
          conditions: conditions
        });

        if (!result.content?.[0]?.text || typeof result.content[0].text !== 'string') {
          throw new Error('Invalid response content structure from checkPermission');
        }
        const rawResponse = safeJsonParse(result.content[0].text);
        if (!isValidRBACResponse(rawResponse)) {
          throw new Error('Invalid RBAC response format');
        }
        
        // より厳密な権限チェック結果の検証
        if (isValidPermissionCheckResult(rawResponse.result)) {
          return rawResponse.result.permitted;
        }
        
        return Boolean(rawResponse.result);
      } catch (error) {
        console.error('❌ Failed to check persona permission:', error);
        return false;
      }
    },
    updatePersonaPermissions: async function(
      contextId: string, 
      permissionsToAdd?: Permission[], 
      permissionsToRemove?: Permission[]
    ): Promise<boolean> {
      try {
        const result = await rbacTools.updatePermissions({
          context_id: contextId,
          permissions_to_add: permissionsToAdd,
          permissions_to_remove: permissionsToRemove
        });

        if (!result.content?.[0]?.text || typeof result.content[0].text !== 'string') {
          throw new Error('Invalid response content structure from updatePermissions');
        }
        const rawResponse = safeJsonParse(result.content[0].text);
        if (!isValidRBACResponse(rawResponse)) {
          throw new Error('Invalid RBAC response format');
        }
        return rawResponse.success === true;
      } catch (error) {
        console.error('❌ Failed to update persona permissions:', error);
        return false;
      }
    },
    getPersonaHierarchyTree: async function(
      rootContextId?: string
    ): Promise<PersonaHierarchyTree | null> {
      try {
        const result = await rbacTools.getHierarchyTree({
          root_context_id: rootContextId
        });

        if (!result.content?.[0]?.text || typeof result.content[0].text !== 'string') {
          throw new Error('Invalid response content structure from getHierarchyTree');
        }
        const rawResponse = safeJsonParse(result.content[0].text);
        if (!isValidRBACResponse(rawResponse)) {
          throw new Error('Invalid RBAC response format');
        }
        return rawResponse.result as PersonaHierarchyTree;
      } catch (error) {
        console.error('❌ Failed to get persona hierarchy tree:', error);
        return null;
      }
    },
    getPersonaSelfCapabilities: async function(
      contextId: string
    ): Promise<PersonaSelfCapabilities | null> {
      try {
        const result = await rbacTools.getSelfCapabilities({
          context_id: contextId
        });

        if (!result.content?.[0]?.text || typeof result.content[0].text !== 'string') {
          throw new Error('Invalid response content structure from getSelfCapabilities');
        }
        const rawResponse = safeJsonParse(result.content[0].text);
        if (!isValidRBACResponse(rawResponse)) {
          throw new Error('Invalid RBAC response format');
        }
        return rawResponse.result as PersonaSelfCapabilities;
      } catch (error) {
        console.error('❌ Failed to get persona self capabilities:', error);
        return null;
      }
    },
    cleanup: function(): void {
      rbacTools.dispose();
      console.log('🛑 RBAC PersonaManager cleaned up');
    }
  };

  // PersonaManagerとRBAC機能を組み合わせ
  const extended = Object.assign(personaManager, rbacExtensions) as RBACPersonaManager;

  console.log('🔧 PersonaManager extended with RBAC capabilities');
  return extended;
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
export function validateRBACIntegration(personaManager: RBACPersonaManager): boolean {
  const methods = [
    personaManager.createPersonaHierarchy,
    personaManager.getPersonaPermissions,
    personaManager.checkPersonaPermission,
    personaManager.updatePersonaPermissions,
    personaManager.getPersonaHierarchyTree,
    personaManager.getPersonaSelfCapabilities
  ];

  const methodNames = [
    'createPersonaHierarchy',
    'getPersonaPermissions', 
    'checkPersonaPermission',
    'updatePersonaPermissions',
    'getPersonaHierarchyTree',
    'getPersonaSelfCapabilities'
  ];

  for (let i = 0; i < methods.length; i++) {
    if (typeof methods[i] !== 'function') {
      console.error(`❌ RBAC integration validation failed: missing method ${methodNames[i]}`);
      return false;
    }
  }

  console.log('✅ RBAC integration validation passed');
  return true;
}
