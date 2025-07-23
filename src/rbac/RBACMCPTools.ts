/**
 * Phase 2: RBAC MCP Tools - 人格階層管理と権限制御のMCPツール群
 * MCPプロトコルに準拠したツール実装
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { 
  RBACAPIService, 
  CreateHierarchyRequest, 
  GetPermissionsRequest,
  CheckPermissionRequest,
  GetHierarchyTreeRequest,
  GetHierarchyTreeResponse,
  UpdatePermissionsRequest
} from './RBACAPIService.js';
import { HierarchyNode, EffectivePermissions } from './RBACEngine.js';

// 自己能力認識の引数型
interface SelfCapabilitiesRequest {
  context_id: string;
  include_tools?: boolean;
  include_memory_scope?: boolean;
  include_hierarchy_position?: boolean;
}

// 能力分析結果の型
interface CapabilityAnalysis {
  context_id: string;
  self_awareness: {
    permission_summary: {
      total_effective_permissions: number;
      direct_permissions: number;
      inherited_permissions: number;
      inheritance_ratio: number;
    };
    tool_capabilities?: {
      available_tools: string[];
      tool_count: number;
      tool_categories: Record<string, string[]>;
    };
    memory_access?: {
      scope: string;
      access_level: string;
      scope_analysis: MemoryScopeAnalysis;
    };
    hierarchy_position?: {
      has_parent: boolean;
      parent_context_id?: string;
      children_count: number;
      depth_in_hierarchy: number;
      ancestors_count: number;
      descendants_count: number;
      position_type: string;
    };
  };
}

// メモリスコープ分析の型
interface MemoryScopeAnalysis {
  level: string;
  description: string;
  scopes?: string[];
}

// 階層情報型
interface HierarchyInfo {
  parent_context_id?: string;
  children_context_ids: string[];
  depth_in_hierarchy: number;
  ancestors_count: number;
  descendants_count: number;
}

// ツール定義とスキーマ
export const RBAC_TOOLS = {
  // 1. 階層関係の作成
  'rbac-create-hierarchy': {
    name: 'rbac-create-hierarchy',
    description: 'Create parent-child hierarchy relationship between personas with permission inheritance',
    inputSchema: {
      type: 'object',
      properties: {
        parent_context_id: {
          type: 'string',
          description: 'Parent persona context ID that will grant permissions'
        },
        child_context_id: {
          type: 'string', 
          description: 'Child persona context ID that will inherit permissions'
        },
        permissions_to_inherit: {
          type: 'array',
          description: 'Specific permissions to inherit (optional - will inherit all if not specified)',
          items: {
            type: 'object',
            properties: {
              action: { type: 'string', description: 'Permission action (e.g., "read", "write", "execute")' },
              resource: { type: 'string', description: 'Resource identifier (e.g., "memory", "tool:search")' },
              conditions: { 
                type: 'object', 
                description: 'Additional conditions for permission',
                additionalProperties: true 
              }
            },
            required: ['action', 'resource']
          }
        },
        metadata: {
          type: 'object',
          description: 'Additional metadata for the hierarchy relationship',
          additionalProperties: true
        }
      },
      required: ['parent_context_id', 'child_context_id']
    }
  },

  // 2. 権限取得
  'rbac-get-permissions': {
    name: 'rbac-get-permissions',
    description: 'Get effective permissions for a persona including inherited permissions',
    inputSchema: {
      type: 'object',
      properties: {
        context_id: {
          type: 'string',
          description: 'Persona context ID to get permissions for'
        },
        include_hierarchy: {
          type: 'boolean',
          description: 'Include hierarchy information (parent, children, depth)',
          default: false
        },
        use_cache: {
          type: 'boolean',
          description: 'Use cached permissions if available',
          default: true
        }
      },
      required: ['context_id']
    }
  },

  // 3. 権限チェック
  'rbac-check-permission': {
    name: 'rbac-check-permission',
    description: 'Check if a persona has specific permission for an action on a resource',
    inputSchema: {
      type: 'object',
      properties: {
        context_id: {
          type: 'string',
          description: 'Persona context ID to check permissions for'
        },
        action: {
          type: 'string',
          description: 'Action to check (e.g., "read", "write", "execute", "admin")'
        },
        resource: {
          type: 'string',
          description: 'Resource to check access to (e.g., "memory", "tool:search", "persona:create")'
        },
        conditions: {
          type: 'object',
          description: 'Additional conditions for permission check',
          additionalProperties: true
        }
      },
      required: ['context_id', 'action', 'resource']
    }
  },

  // 4. 階層ツリー取得
  'rbac-get-hierarchy-tree': {
    name: 'rbac-get-hierarchy-tree',
    description: 'Get the complete or partial hierarchy tree of persona relationships',
    inputSchema: {
      type: 'object',
      properties: {
        root_context_id: {
          type: 'string',
          description: 'Root persona to start tree from (optional - gets full tree if not specified)'
        },
        max_depth: {
          type: 'number',
          description: 'Maximum depth to traverse in hierarchy',
          minimum: 1
        },
        include_permissions: {
          type: 'boolean',
          description: 'Include permission details for each node',
          default: false
        }
      }
    }
  },

  // 5. 権限更新
  'rbac-update-permissions': {
    name: 'rbac-update-permissions',
    description: 'Add or remove permissions for a persona and recalculate inheritance',
    inputSchema: {
      type: 'object',
      properties: {
        context_id: {
          type: 'string',
          description: 'Persona context ID to update permissions for'
        },
        permissions_to_add: {
          type: 'array',
          description: 'Permissions to add to the persona',
          items: {
            type: 'object',
            properties: {
              action: { type: 'string' },
              resource: { type: 'string' },
              conditions: { type: 'object', additionalProperties: true }
            },
            required: ['action', 'resource']
          }
        },
        permissions_to_remove: {
          type: 'array', 
          description: 'Permissions to remove from the persona',
          items: {
            type: 'object',
            properties: {
              action: { type: 'string' },
              resource: { type: 'string' },
              conditions: { type: 'object', additionalProperties: true }
            },
            required: ['action', 'resource']
          }
        },
        recalculate_inheritance: {
          type: 'boolean',
          description: 'Whether to recalculate inheritance after update',
          default: true
        }
      },
      required: ['context_id']
    }
  },

  // 6. 人格能力の自己認識
  'rbac-get-self-capabilities': {
    name: 'rbac-get-self-capabilities',
    description: 'Get comprehensive self-awareness of persona capabilities and limitations',
    inputSchema: {
      type: 'object',
      properties: {
        context_id: {
          type: 'string',
          description: 'Persona context ID to analyze capabilities for'
        },
        include_tools: {
          type: 'boolean',
          description: 'Include available tools analysis',
          default: true
        },
        include_memory_scope: {
          type: 'boolean',
          description: 'Include memory access scope analysis',
          default: true
        },
        include_hierarchy_position: {
          type: 'boolean',
          description: 'Include position in hierarchy analysis',
          default: true
        }
      },
      required: ['context_id']
    }
  }
} as const;

// MCPツール実装クラス
export class RBACMCPTools {
  private rbacService: RBACAPIService;

  constructor(dbPath: string) {
    this.rbacService = new RBACAPIService(dbPath);
    console.log('🔧 RBAC MCP Tools initialized');
  }

  /**
   * 階層関係の作成ツール
   */
  async createHierarchy(args: CreateHierarchyRequest): Promise<CallToolResult> {
    try {
      // 入力検証 - 不正データは門前払い
      if (!args.parent_context_id || typeof args.parent_context_id !== 'string') {
        throw new Error('Invalid parent_context_id: must be a non-empty string');
      }
      if (!args.child_context_id || typeof args.child_context_id !== 'string') {
        throw new Error('Invalid child_context_id: must be a non-empty string');
      }
      if (args.parent_context_id === args.child_context_id) {
        throw new Error('parent_context_id and child_context_id cannot be the same');
      }

      const request: CreateHierarchyRequest = {
        parent_context_id: args.parent_context_id,
        child_context_id: args.child_context_id,
        permissions_to_inherit: args.permissions_to_inherit,
        metadata: args.metadata
      };

      const response = await this.rbacService.createHierarchy(request);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            tool: 'rbac-create-hierarchy',
            success: response.success,
            result: {
              hierarchy_created: response.hierarchy_created,
              parent_context_id: response.parent_context_id,
              child_context_id: response.child_context_id,
              permissions_inherited: response.permissions_inherited,
              message: response.success 
                ? `Successfully created hierarchy: ${response.parent_context_id} -> ${response.child_context_id}`
                : `Failed to create hierarchy: ${response.error_message}`
            },
            error: response.error_message
          }, null, 2)
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            tool: 'rbac-create-hierarchy',
            success: false,
            error: error instanceof Error ? error.message : String(error)
          }, null, 2)
        }]
      };
    }
  }

  /**
   * 権限取得ツール
   */
  async getPermissions(args: GetPermissionsRequest): Promise<CallToolResult> {
    try {
      // 入力検証 - 不正データは門前払い
      if (!args.context_id || typeof args.context_id !== 'string') {
        throw new Error('Invalid context_id: must be a non-empty string');
      }

      const request: GetPermissionsRequest = {
        context_id: args.context_id,
        include_hierarchy: args.include_hierarchy,
        use_cache: args.use_cache
      };

      const response = await this.rbacService.getPermissions(request);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            tool: 'rbac-get-permissions',
            success: response.success,
            result: {
              context_id: response.context_id,
              direct_permissions_count: response.effective_permissions.direct_permissions.length,
              inherited_permissions_count: response.effective_permissions.inherited_permissions.length,
              effective_permissions_count: response.effective_permissions.effective_permissions.length,
              effective_tools: response.effective_permissions.effective_tools,
              effective_memory_scope: response.effective_permissions.effective_memory_scope,
              hierarchy_info: response.hierarchy_info,
              permissions_detail: {
                direct_permissions: response.effective_permissions.direct_permissions,
                inherited_permissions: response.effective_permissions.inherited_permissions,
                effective_permissions: response.effective_permissions.effective_permissions
              },
              computed_at: response.effective_permissions.computed_at,
              cache_version: response.effective_permissions.cache_version
            },
            error: response.error_message
          }, null, 2)
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            tool: 'rbac-get-permissions',
            success: false,
            error: error instanceof Error ? error.message : String(error)
          }, null, 2)
        }]
      };
    }
  }

  /**
   * 権限チェックツール
   */
  async checkPermission(args: CheckPermissionRequest): Promise<CallToolResult> {
    try {
      // 入力検証 - 不正データは門前払い
      if (!args.context_id || typeof args.context_id !== 'string') {
        throw new Error('Invalid context_id: must be a non-empty string');
      }
      if (!args.action || typeof args.action !== 'string') {
        throw new Error('Invalid action: must be a non-empty string');
      }
      if (!args.resource || typeof args.resource !== 'string') {
        throw new Error('Invalid resource: must be a non-empty string');
      }

      const request: CheckPermissionRequest = {
        context_id: args.context_id,
        action: args.action,
        resource: args.resource,
        conditions: args.conditions
      };

      const response = await this.rbacService.checkPermission(request);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            tool: 'rbac-check-permission',
            success: response.success,
            result: {
              context_id: response.context_id,
              permission_check: {
                action: response.action,
                resource: response.resource,
                granted: response.permission_granted,
                reason: response.reason
              },
              applicable_permissions: response.applicable_permissions,
              recommendation: response.permission_granted 
                ? 'Access granted - you may proceed with the requested action'
                : 'Access denied - consider requesting permission or using a different approach'
            },
            error: response.error_message
          }, null, 2)
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            tool: 'rbac-check-permission',
            success: false,
            error: error instanceof Error ? error.message : String(error)
          }, null, 2)
        }]
      };
    }
  }

  /**
   * 階層ツリー取得ツール
   */
  async getHierarchyTree(args: GetHierarchyTreeRequest = {}): Promise<CallToolResult> {
    try {
      // 入力検証
      if (args.max_depth !== undefined && (typeof args.max_depth !== 'number' || args.max_depth < 1)) {
        throw new Error('Invalid max_depth: must be a positive number');
      }

      const request: GetHierarchyTreeRequest = {
        root_context_id: args.root_context_id,
        max_depth: args.max_depth,
        include_permissions: args.include_permissions
      };

      const response = await this.rbacService.getHierarchyTree(request);

      // 階層ツリーの可視化形式を作成
      const treeVisualization = this.buildTreeVisualization(response.hierarchy_tree);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            tool: 'rbac-get-hierarchy-tree',
            success: response.success,
            result: {
              summary: {
                total_nodes: response.total_nodes,
                max_depth_found: response.max_depth_found,
                root_nodes_count: response.root_nodes.length,
                root_nodes: response.root_nodes
              },
              tree_visualization: treeVisualization,
              detailed_nodes: response.hierarchy_tree,
              analysis: {
                has_hierarchies: response.total_nodes > 0,
                complexity_level: response.max_depth_found > 3 ? 'complex' : 'simple',
                recommendations: this.generateHierarchyRecommendations(response)
              }
            },
            error: response.error_message
          }, null, 2)
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            tool: 'rbac-get-hierarchy-tree',
            success: false,
            error: error instanceof Error ? error.message : String(error)
          }, null, 2)
        }]
      };
    }
  }

  /**
   * 権限更新ツール
   */
  async updatePermissions(args: UpdatePermissionsRequest): Promise<CallToolResult> {
    try {
      // 入力検証 - 不正データは門前払い
      if (!args.context_id || typeof args.context_id !== 'string') {
        throw new Error('Invalid context_id: must be a non-empty string');
      }

      const request: UpdatePermissionsRequest = {
        context_id: args.context_id,
        permissions_to_add: args.permissions_to_add,
        permissions_to_remove: args.permissions_to_remove,
        recalculate_inheritance: args.recalculate_inheritance
      };

      const response = await this.rbacService.updatePermissions(request);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            tool: 'rbac-update-permissions',
            success: response.success,
            result: {
              context_id: response.context_id,
              changes_applied: {
                permissions_added: response.permissions_added,
                permissions_removed: response.permissions_removed,
                inheritance_recalculated: response.inheritance_recalculated
              },
              final_state: {
                effective_permissions_count: response.effective_permissions_count
              },
              message: response.success
                ? `Successfully updated permissions for ${response.context_id}`
                : `Failed to update permissions: ${response.error_message}`
            },
            error: response.error_message
          }, null, 2)
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            tool: 'rbac-update-permissions',
            success: false,
            error: error instanceof Error ? error.message : String(error)
          }, null, 2)
        }]
      };
    }
  }

  /**
   * 自己能力認識ツール
   */
  async getSelfCapabilities(args: SelfCapabilitiesRequest): Promise<CallToolResult> {
    try {
      // 入力検証 - 不正データは門前払い
      if (!args.context_id || typeof args.context_id !== 'string') {
        throw new Error('Invalid context_id: must be a non-empty string');
      }

      const contextId = args.context_id;
      
      // 基本権限情報取得
      const permissionsResponse = await this.rbacService.getPermissions({
        context_id: contextId,
        include_hierarchy: true,
        use_cache: true
      });

      if (!permissionsResponse.success) {
        throw new Error(permissionsResponse.error_message);
      }

      // 階層情報取得
      const hierarchyResponse = await this.rbacService.getHierarchyTree({});
      
      // 能力分析
      const capabilities = this.analyzeCapabilities(
        permissionsResponse.effective_permissions,
        permissionsResponse.hierarchy_info,
        hierarchyResponse.hierarchy_tree,
        args
      );

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            tool: 'rbac-get-self-capabilities',
            success: true,
            result: capabilities
          }, null, 2)
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            tool: 'rbac-get-self-capabilities',
            success: false,
            error: error instanceof Error ? error.message : String(error)
          }, null, 2)
        }]
      };
    }
  }

  /**
   * 階層ツリーの可視化
   */
  private buildTreeVisualization(nodes: HierarchyNode[]): string[] {
    const visualization: string[] = [];
    const rootNodes = nodes.filter(node => !node.parent_id);

    for (const root of rootNodes) {
      this.buildNodeVisualization(root, nodes, visualization, 0);
    }

    return visualization;
  }

  private buildNodeVisualization(node: HierarchyNode, allNodes: HierarchyNode[], visualization: string[], depth: number): void {
    const indent = '  '.repeat(depth);
    const prefix = depth === 0 ? '🌳' : '├─';
    visualization.push(`${indent}${prefix} ${node.context_id} (depth: ${node.depth})`);

    for (const childId of node.children) {
      const childNode = allNodes.find(n => n.context_id === childId);
      if (childNode) {
        this.buildNodeVisualization(childNode, allNodes, visualization, depth + 1);
      }
    }
  }

  /**
   * 階層分析の推奨事項生成
   */
  private generateHierarchyRecommendations(response: GetHierarchyTreeResponse): string[] {
    const recommendations: string[] = [];

    if (response.total_nodes === 0) {
      recommendations.push('No hierarchies detected - consider creating parent-child relationships for permission inheritance');
    }

    if (response.max_depth_found > 5) {
      recommendations.push('Deep hierarchy detected - consider flattening for better performance');
    }

    if (response.root_nodes.length > 10) {
      recommendations.push('Many root nodes detected - consider consolidating under master personas');
    }

    return recommendations;
  }

  /**
   * 能力分析
   */
  private analyzeCapabilities(effectivePermissions: EffectivePermissions, hierarchyInfo: HierarchyInfo | undefined, hierarchyTree: HierarchyNode[], args: SelfCapabilitiesRequest): CapabilityAnalysis {
    const capabilities: CapabilityAnalysis = {
      context_id: effectivePermissions.context_id,
      self_awareness: {
        permission_summary: {
          total_effective_permissions: effectivePermissions.effective_permissions.length,
          direct_permissions: effectivePermissions.direct_permissions.length,
          inherited_permissions: effectivePermissions.inherited_permissions.length,
          inheritance_ratio: effectivePermissions.inherited_permissions.length / Math.max(effectivePermissions.effective_permissions.length, 1)
        }
      }
    };

    // ツール分析
    if (args.include_tools) {
      capabilities.self_awareness.tool_capabilities = {
        available_tools: effectivePermissions.effective_tools,
        tool_count: effectivePermissions.effective_tools.length,
        tool_categories: this.categorizeTools(effectivePermissions.effective_tools)
      };
    }

    // メモリスコープ分析
    if (args.include_memory_scope) {
      capabilities.self_awareness.memory_access = {
        scope: effectivePermissions.effective_memory_scope,
        access_level: effectivePermissions.effective_memory_scope === '*' ? 'full' : 'limited',
        scope_analysis: this.analyzeMemoryScope(effectivePermissions.effective_memory_scope)
      };
    }

    // 階層ポジション分析
    if (args.include_hierarchy_position && hierarchyInfo) {
      capabilities.self_awareness.hierarchy_position = {
        has_parent: !!hierarchyInfo.parent_context_id,
        parent_context_id: hierarchyInfo.parent_context_id,
        children_count: hierarchyInfo.children_context_ids.length,
        depth_in_hierarchy: hierarchyInfo.depth_in_hierarchy,
        ancestors_count: hierarchyInfo.ancestors_count,
        descendants_count: hierarchyInfo.descendants_count,
        position_type: this.determinePositionType(hierarchyInfo)
      };
    }

    return capabilities;
  }

  private categorizeTools(tools: string[]): Record<string, string[]> {
    const categories: Record<string, string[]> = {
      memory: [],
      search: [],
      generation: [],
      management: [],
      other: []
    };

    for (const tool of tools) {
      if (tool.includes('memory')) {
        categories.memory.push(tool);
      } else if (tool.includes('search') || tool.includes('fetch')) {
        categories.search.push(tool);
      } else if (tool.includes('generate') || tool.includes('create')) {
        categories.generation.push(tool);
      } else if (tool.includes('manage') || tool.includes('update')) {
        categories.management.push(tool);
      } else {
        categories.other.push(tool);
      }
    }

    return categories;
  }

  private analyzeMemoryScope(scope: string): MemoryScopeAnalysis {
    if (scope === '*') {
      return { level: 'global', description: 'Full access to all memory scopes' };
    } else if (scope === '') {
      return { level: 'none', description: 'No memory access permissions' };
    } else {
      const scopes = scope.split(',');
      return { 
        level: 'scoped', 
        description: `Access to ${scopes.length} specific scope(s)`,
        scopes: scopes
      };
    }
  }

  private determinePositionType(hierarchyInfo: HierarchyInfo): string {
    if (!hierarchyInfo.parent_context_id && hierarchyInfo.children_context_ids.length === 0) {
      return 'isolated';
    } else if (!hierarchyInfo.parent_context_id && hierarchyInfo.children_context_ids.length > 0) {
      return 'root';
    } else if (hierarchyInfo.parent_context_id && hierarchyInfo.children_context_ids.length === 0) {
      return 'leaf';
    } else {
      return 'intermediate';
    }
  }

  /**
   * ツール群のクリーンアップ
   */
  dispose(): void {
    this.rbacService.dispose();
    console.log('🛑 RBAC MCP Tools disposed');
  }
}
