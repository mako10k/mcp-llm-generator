// Sprint4 Phase 1: ペルソナ管理統合システム
import Database from 'better-sqlite3';
import { 
  PersonaCapabilities, 
  PersonaRole, 
  TaskDelegation, 
  MergeStrategy,
  MergeStrategyType,
  PromptSecurityLevel,
  SecurityValidationResult
} from '../types/persona.js';
import { promptTokenManager } from '../utils/promptOptimization.js';
import { promptSecurityManager } from '../utils/promptSecurity.js';

export class PersonaManager {
  private db: Database.Database;

  constructor(database: Database.Database) {
    this.db = database;
  }

  /**
   * ペルソナ能力の取得
   */
  getPersonaCapabilities(contextId: string): PersonaCapabilities | null {
    try {
      const stmt = this.db.prepare(`
        SELECT pc.*, pr.role_type, pr.permissions
        FROM persona_capabilities pc
        LEFT JOIN persona_roles pr ON pc.context_id = pr.context_id
        WHERE pc.context_id = ?
      `);
      
      const result = stmt.get(contextId) as any;
      if (!result) return null;

      return {
        expertise: JSON.parse(result.expertise || '[]'),
        tools: JSON.parse(result.tools || '[]'),
        restrictions: JSON.parse(result.restrictions || '[]'),
        performance_metrics: result.performance_metrics ? JSON.parse(result.performance_metrics) : undefined,
        learning_capabilities: result.learning_capabilities ? JSON.parse(result.learning_capabilities) : undefined
      };
    } catch (error) {
      console.error('❌ Failed to get persona capabilities:', error);
      return null;
    }
  }

  /**
   * ペルソナ能力の更新
   */
  updatePersonaCapabilities(contextId: string, capabilities: PersonaCapabilities): boolean {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO persona_capabilities (
          context_id, expertise, tools, restrictions, 
          performance_metrics, learning_capabilities, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `);

      stmt.run(
        contextId,
        JSON.stringify(capabilities.expertise),
        JSON.stringify(capabilities.tools),
        JSON.stringify(capabilities.restrictions),
        capabilities.performance_metrics ? JSON.stringify(capabilities.performance_metrics) : null,
        capabilities.learning_capabilities ? JSON.stringify(capabilities.learning_capabilities) : null
      );

      console.log(`✅ Updated persona capabilities for context ${contextId}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to update persona capabilities:', error);
      return false;
    }
  }

  /**
   * ロール権限の確認
   */
  checkRolePermissions(contextId: string, requiredPermission: string): boolean {
    try {
      const stmt = this.db.prepare(`
        SELECT permissions FROM persona_roles WHERE context_id = ?
      `);
      
      const result = stmt.get(contextId) as any;
      if (!result) return false;

      const permissions = JSON.parse(result.permissions || '[]');
      return permissions.includes(requiredPermission) || permissions.includes('admin');
    } catch (error) {
      console.error('❌ Failed to check role permissions:', error);
      return false;
    }
  }

  /**
   * タスク委譲の作成
   */
  createTaskDelegation(delegation: Omit<TaskDelegation, 'delegation_id' | 'created_at' | 'updated_at'>): string | null {
    try {
      const delegationId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const stmt = this.db.prepare(`
        INSERT INTO task_delegations (
          delegation_id, from_context_id, to_context_id, task_description,
          required_capabilities, priority_level, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `);

      stmt.run(
        delegationId,
        delegation.from_context_id,
        delegation.to_context_id,
        delegation.task_description,
        JSON.stringify(delegation.required_capabilities),
        delegation.priority_level,
        delegation.status // ここでdelegation.statusを使用
      );

      console.log(`✅ Created task delegation: ${delegationId}`);
      return delegationId;
    } catch (error) {
      console.error('❌ Failed to create task delegation:', error);
      return null;
    }
  }

  /**
   * 適切なペルソナの検索
   */
  findSuitablePersona(requiredCapabilities: string[], excludeContextIds: string[] = []): string | null {
    try {
      const placeholders = requiredCapabilities.map(() => '?').join(',');
      const excludePlaceholders = excludeContextIds.map(() => '?').join(',');
      
      let query = `
        SELECT 
          pc.context_id,
          pc.expertise,
          pc.tools,
          COUNT(*) as capability_matches
        FROM persona_capabilities pc
        LEFT JOIN persona_roles pr ON pc.context_id = pr.context_id
        WHERE (
          json_extract(pc.expertise, '$') LIKE '%' || ? || '%' OR
          json_extract(pc.tools, '$') LIKE '%' || ? || '%'
        )
      `;
      
      if (excludeContextIds.length > 0) {
        query += ` AND pc.context_id NOT IN (${excludePlaceholders})`;
      }
      
      query += ` GROUP BY pc.context_id ORDER BY capability_matches DESC LIMIT 1`;

      const stmt = this.db.prepare(query);
      const params = [
        ...requiredCapabilities.map(cap => `%${cap}%`).slice(0, 2), // LIKE用
        ...excludeContextIds
      ];
      
      const result = stmt.get(...params) as any;
      return result?.context_id || null;
    } catch (error) {
      console.error('❌ Failed to find suitable persona:', error);
      return null;
    }
  }

  /**
   * プロンプト最適化（セキュリティチェック付き）
   */
  optimizePromptForPersona(
    contextId: string,
    basePrompt: string,
    options: {
      max_tokens?: number;
      model?: string;
      security_level?: PromptSecurityLevel;
      task_context?: string;
    } = {}
  ): {
    optimized_prompt: string;
    security_result: SecurityValidationResult;
    token_analysis: any;
    applied_optimizations: string[];
  } {
    const appliedOptimizations: string[] = [];
    
    // 1. セキュリティチェック
    const securityLevel = options.security_level || 'medium';
    const securityResult = promptSecurityManager.validatePrompt(basePrompt, securityLevel);
    
    if (!securityResult.is_safe) {
      console.warn(`⚠️ Security risk detected (score: ${securityResult.risk_score})`);
      const sanitized = promptSecurityManager.sanitizePrompt(basePrompt, securityLevel);
      basePrompt = sanitized.sanitized_prompt;
      appliedOptimizations.push('security_sanitization');
    }

    // 2. ペルソナ能力の取得と最適化
    const capabilities = this.getPersonaCapabilities(contextId);
    let optimizedPrompt = basePrompt;
    
    if (capabilities) {
      const compressed = options.task_context 
        ? promptTokenManager.selectRelevantCapabilities(options.task_context, capabilities)
        : promptTokenManager.compressCapabilities(capabilities);

      const optimizationOptions = {
        max_tokens: options.max_tokens || 4000,
        model: options.model || 'gpt-4',
        compression_level: 'medium' as const,
        include_expertise_only: false,
        include_tools_only: false
      };

      optimizedPrompt = promptTokenManager.optimizePrompt(
        basePrompt,
        compressed,
        optimizationOptions
      );
      
      appliedOptimizations.push('capability_optimization');
    }

    // 3. トークン分析
    const tokenAnalysis = promptTokenManager.analyzePromptTokens(
      optimizedPrompt,
      options.model || 'gpt-4'
    );

    return {
      optimized_prompt: optimizedPrompt,
      security_result: securityResult,
      token_analysis: tokenAnalysis,
      applied_optimizations: appliedOptimizations
    };
  }

  /**
   * ペルソナの親子関係記録
   */
  recordPersonaLineage(
    parentContextId: string,
    childContextId: string,
    relationshipType: 'derived' | 'merged' | 'forked'
  ): boolean {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO persona_lineage (
          parent_context_id, child_context_id, relationship_type, created_at
        ) VALUES (?, ?, ?, datetime('now'))
      `);

      stmt.run(parentContextId, childContextId, relationshipType);
      console.log(`✅ Recorded persona lineage: ${parentContextId} -> ${childContextId} (${relationshipType})`);
      return true;
    } catch (error) {
      console.error('❌ Failed to record persona lineage:', error);
      return false;
    }
  }

  /**
   * ペルソナのマージ実行
   */
  mergePersonas(
    sourceContextIds: string[],
    targetContextId: string,
    strategy: MergeStrategyType = 'union'
  ): boolean {
    try {
      this.db.transaction(() => {
        // 1. ソースペルソナの能力取得
        const sourceCapabilities = sourceContextIds.map(id => this.getPersonaCapabilities(id))
          .filter(cap => cap !== null) as PersonaCapabilities[];

        if (sourceCapabilities.length === 0) {
          throw new Error('No valid source personas found');
        }

        // 2. マージ戦略に基づく能力統合
        const mergedCapabilities = this.executeCapabilityMerge(sourceCapabilities, strategy);

        // 3. ターゲットペルソナの更新
        this.updatePersonaCapabilities(targetContextId, mergedCapabilities);

        // 4. マージ監査記録
        const auditStmt = this.db.prepare(`
          INSERT INTO persona_merge_audit (
            source_context_ids, target_context_id, merge_strategy,
            merged_capabilities, created_at
          ) VALUES (?, ?, ?, ?, datetime('now'))
        `);

        auditStmt.run(
          JSON.stringify(sourceContextIds),
          targetContextId,
          strategy,
          JSON.stringify(mergedCapabilities)
        );

        // 5. 系譜記録
        sourceContextIds.forEach(sourceId => {
          this.recordPersonaLineage(sourceId, targetContextId, 'merged');
        });
      })();

      console.log(`✅ Successfully merged personas into ${targetContextId}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to merge personas:', error);
      return false;
    }
  }

  /**
   * 能力マージの実行
   */
  private executeCapabilityMerge(
    capabilities: PersonaCapabilities[],
    strategy: MergeStrategyType
  ): PersonaCapabilities {
    switch (strategy) {
      case 'union':
        return {
          expertise: [...new Set(capabilities.flatMap(c => c.expertise))],
          tools: [...new Set(capabilities.flatMap(c => c.tools))],
          restrictions: [...new Set(capabilities.flatMap(c => c.restrictions))]
        };

      case 'intersection':
        const firstCap = capabilities[0];
        return {
          expertise: firstCap.expertise.filter(exp => 
            capabilities.every(c => c.expertise.includes(exp))
          ),
          tools: firstCap.tools.filter(tool => 
            capabilities.every(c => c.tools.includes(tool))
          ),
          restrictions: firstCap.restrictions.filter(res => 
            capabilities.every(c => c.restrictions.includes(res))
          )
        };

      case 'weighted_average':
        // 重み付き平均（簡易実装）
        const weightedExpertise = this.getTopSkills(capabilities.flatMap(c => c.expertise), 10);
        const weightedTools = this.getTopSkills(capabilities.flatMap(c => c.tools), 15);
        
        return {
          expertise: weightedExpertise,
          tools: weightedTools,
          restrictions: [...new Set(capabilities.flatMap(c => c.restrictions))]
        };

      default:
        return capabilities[0];
    }
  }

  /**
   * 使用頻度に基づくトップスキル抽出
   */
  private getTopSkills(skills: string[], limit: number): string[] {
    const frequency = skills.reduce((acc, skill) => {
      acc[skill] = (acc[skill] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(frequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([skill]) => skill);
  }

  /**
   * ペルソナ統計の取得
   */
  getPersonaStatistics(): {
    total_personas: number;
    active_delegations: number;
    merge_operations: number;
    security_incidents: number;
  } {
    try {
      const totalPersonas = this.db.prepare('SELECT COUNT(*) as count FROM persona_capabilities').get() as any;
      const activeDelegations = this.db.prepare("SELECT COUNT(*) as count FROM task_delegations WHERE status IN ('pending', 'in_progress')").get() as any;
      const mergeOperations = this.db.prepare('SELECT COUNT(*) as count FROM persona_lineage').get() as any;

      return {
        total_personas: totalPersonas.count,
        active_delegations: activeDelegations.count,
        merge_operations: mergeOperations.count,
        security_incidents: 0 // TODO: セキュリティインシデント追跡実装
      };
    } catch (error) {
      console.error('❌ Failed to get persona statistics:', error);
      return {
        total_personas: 0,
        active_delegations: 0,
        merge_operations: 0,
        security_incidents: 0
      };
    }
  }

  /**
   * 権限階層管理 - 新機能
   */
  createRoleHierarchy(
    parentRoleId: string, 
    childRoleId: string, 
    contextId: string,
    roleType: string,
    permissions: string[],
    description?: string
  ): boolean {
    try {
      let parentLevel = 0;
      let actualParentRoleId: string | null = null;

      // 親ロールが指定されている場合のみ階層レベルを取得
      if (parentRoleId && parentRoleId.trim() !== '') {
        const parentRole = this.db.prepare('SELECT hierarchy_level FROM persona_roles WHERE role_id = ?').get(parentRoleId) as any;
        if (parentRole) {
          parentLevel = parentRole.hierarchy_level;
          actualParentRoleId = parentRoleId;
        }
      }

      const stmt = this.db.prepare(`
        INSERT INTO persona_roles (
          role_id, context_id, role_type, permissions, role_description,
          parent_role_id, hierarchy_level, is_active, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
      `);

      stmt.run(
        childRoleId,
        contextId,
        roleType,
        JSON.stringify(permissions),
        description || '',
        actualParentRoleId,
        parentLevel + 1
      );

      console.log(`✅ Created role hierarchy: ${parentRoleId || 'root'} -> ${childRoleId}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to create role hierarchy:', error);
      return false;
    }
  }

  /**
   * タスク委譲状況監視 - 新機能
   */
  getDelegationStatus(delegationId: string): {
    status: string;
    progress: number;
    estimated_completion?: Date;
    current_step?: string;
  } | null {
    try {
      const stmt = this.db.prepare(`
        SELECT status, result_data, delegation_metadata, 
               created_at, started_at, completed_at
        FROM task_delegations 
        WHERE delegation_id = ?
      `);
      
      const result = stmt.get(delegationId) as any;
      if (!result) return null;

      const metadata = result.delegation_metadata ? JSON.parse(result.delegation_metadata) : {};
      const progress = this.calculateProgress(result.status, metadata);

      return {
        status: result.status,
        progress,
        estimated_completion: metadata.estimated_completion ? new Date(metadata.estimated_completion) : undefined,
        current_step: metadata.current_step
      };
    } catch (error) {
      console.error('❌ Failed to get delegation status:', error);
      return null;
    }
  }

  /**
   * 人格系譜分析 - 新機能
   */
  analyzePersonaLineage(contextId: string): {
    ancestors: Array<{context_id: string, relation: string, depth: number}>;
    descendants: Array<{context_id: string, relation: string, depth: number}>;
    lineage_strength: number;
  } {
    try {
      // 祖先検索（再帰的）
      const ancestors = this.getPersonaAncestors(contextId, 1);
      
      // 子孫検索（再帰的）
      const descendants = this.getPersonaDescendants(contextId, 1);
      
      // 系譜の強度計算
      const lineageStrength = this.calculateLineageStrength(ancestors, descendants);

      return {
        ancestors,
        descendants,
        lineage_strength: lineageStrength
      };
    } catch (error) {
      console.error('❌ Failed to analyze persona lineage:', error);
      return {
        ancestors: [],
        descendants: [],
        lineage_strength: 0
      };
    }
  }

  /**
   * スマート委譲システム - 新機能
   */
  smartDelegateTask(
    fromContextId: string,
    taskDescription: string,
    requiredCapabilities: string[],
    options: {
      priority?: 'low' | 'medium' | 'high' | 'urgent';
      max_candidates?: number;
      exclude_busy?: boolean;
      min_capability_match?: number;
    } = {}
  ): string | null {
    try {
      // 候補ペルソナを能力でランク付け
      const candidates = this.rankCandidatesByCapability(
        requiredCapabilities, 
        [fromContextId], // 自分自身は除外
        options
      );

      if (candidates.length === 0) {
        console.warn('⚠️ No suitable candidates found for task delegation');
        return null;
      }

      // 最適な候補を選択
      const bestCandidate = candidates[0];
      
      // 委譲作成
      const delegationId = this.createTaskDelegation({
        from_context_id: fromContextId,
        to_context_id: bestCandidate.context_id,
        task_description: taskDescription,
        required_capabilities: requiredCapabilities,
        priority_level: options.priority || 'medium',
        status: 'pending'
      });

      if (delegationId) {
        console.log(`✅ Smart delegation created: ${delegationId} -> ${bestCandidate.context_id} (match: ${bestCandidate.capability_score}%)`);
      }

      return delegationId;
    } catch (error) {
      console.error('❌ Failed to smart delegate task:', error);
      return null;
    }
  }

  // === プライベートヘルパーメソッド ===

  private calculateProgress(status: string, metadata: any): number {
    const statusProgress: Record<string, number> = {
      'pending': 0,
      'accepted': 20,
      'in_progress': 50,
      'completed': 100,
      'failed': 0,
      'cancelled': 0
    };
    
    const baseProgress = statusProgress[status] || 0;
    const metadataProgress = metadata.progress_percentage || 0;
    
    return Math.max(baseProgress, metadataProgress);
  }

  private getPersonaAncestors(contextId: string, depth: number, maxDepth: number = 5): Array<{context_id: string, relation: string, depth: number}> {
    if (depth > maxDepth) return [];
    
    const stmt = this.db.prepare(`
      SELECT parent_context_id, merge_strategy
      FROM persona_lineage 
      WHERE child_context_id = ? AND is_active = 1
    `);
    
    const parents = stmt.all(contextId) as any[];
    const result: Array<{context_id: string, relation: string, depth: number}> = [];
    
    parents.forEach(parent => {
      result.push({
        context_id: parent.parent_context_id,
        relation: parent.merge_strategy,
        depth
      });
      
      // 再帰的に祖先を検索
      result.push(...this.getPersonaAncestors(parent.parent_context_id, depth + 1, maxDepth));
    });
    
    return result;
  }

  private getPersonaDescendants(contextId: string, depth: number, maxDepth: number = 5): Array<{context_id: string, relation: string, depth: number}> {
    if (depth > maxDepth) return [];
    
    const stmt = this.db.prepare(`
      SELECT child_context_id, merge_strategy
      FROM persona_lineage 
      WHERE parent_context_id = ? AND is_active = 1
    `);
    
    const children = stmt.all(contextId) as any[];
    const result: Array<{context_id: string, relation: string, depth: number}> = [];
    
    children.forEach(child => {
      result.push({
        context_id: child.child_context_id,
        relation: child.merge_strategy,
        depth
      });
      
      // 再帰的に子孫を検索
      result.push(...this.getPersonaDescendants(child.child_context_id, depth + 1, maxDepth));
    });
    
    return result;
  }

  private calculateLineageStrength(ancestors: any[], descendants: any[]): number {
    const totalConnections = ancestors.length + descendants.length;
    const weightedConnections = ancestors.reduce((sum, a) => sum + (1 / a.depth), 0) + 
                               descendants.reduce((sum, d) => sum + (1 / d.depth), 0);
    
    return Math.min(Math.round((weightedConnections / Math.max(totalConnections, 1)) * 100), 100);
  }

  private rankCandidatesByCapability(
    requiredCapabilities: string[],
    excludeContextIds: string[],
    options: any
  ): Array<{context_id: string, capability_score: number, load_factor: number}> {
    try {
      let query = `
        SELECT 
          pc.context_id,
          pc.expertise,
          pc.tools,
          COUNT(td.delegation_id) as current_load
        FROM persona_capabilities pc
        LEFT JOIN task_delegations td ON pc.context_id = td.to_context_id 
          AND td.status IN ('pending', 'in_progress')
        WHERE pc.context_id NOT IN (${excludeContextIds.map(() => '?').join(',')})
      `;
      
      if (options.exclude_busy) {
        query += ` AND COUNT(td.delegation_id) < 3`;
      }
      
      query += ` GROUP BY pc.context_id`;
      
      const stmt = this.db.prepare(query);
      const candidates = stmt.all(...excludeContextIds) as any[];
      
      return candidates
        .map(candidate => {
          const expertise = JSON.parse(candidate.expertise || '[]');
          const tools = JSON.parse(candidate.tools || '[]');
          const allCapabilities = [...expertise, ...tools];
          
          // 能力一致スコア計算
          const matchCount = requiredCapabilities.filter(req => 
            allCapabilities.some(cap => cap.toLowerCase().includes(req.toLowerCase()))
          ).length;
          
          const capabilityScore = Math.round((matchCount / requiredCapabilities.length) * 100);
          const loadFactor = candidate.current_load || 0;
          
          return {
            context_id: candidate.context_id,
            capability_score: capabilityScore,
            load_factor: loadFactor
          };
        })
        .filter(candidate => 
          candidate.capability_score >= (options.min_capability_match || 30)
        )
        .sort((a, b) => {
          // 能力スコア優先、負荷考慮
          const scoreA = a.capability_score - (a.load_factor * 5);
          const scoreB = b.capability_score - (b.load_factor * 5);
          return scoreB - scoreA;
        })
        .slice(0, options.max_candidates || 5);
    } catch (error) {
      console.error('❌ Failed to rank candidates:', error);
      return [];
    }
  }
}
