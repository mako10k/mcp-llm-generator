import { promptTokenManager } from '../utils/promptOptimization.js';
import { promptSecurityManager } from '../utils/promptSecurity.js';
import { PersonaLogger } from './personaLogger.js';
/**
 * 型安全なPersonaCapabilitiesユーティリティ関数
 */
function safeGetStringArray(array) {
    return Array.isArray(array) ? array : [];
}
function safeJoinStringArray(array, separator = ', ') {
    const safeArray = safeGetStringArray(array);
    return safeArray.length > 0 ? safeArray.join(separator) : '';
}
export class PersonaManager {
    db;
    logger;
    constructor(database) {
        this.db = database;
        this.logger = PersonaLogger.getInstance();
    }
    /**
     * ペルソナ能力の取得
     */
    getPersonaCapabilities(contextId) {
        try {
            const stmt = this.db.prepare(`
        SELECT pc.*, pr.role_type, pr.permissions
        FROM persona_capabilities pc
        LEFT JOIN persona_roles pr ON pc.context_id = pr.context_id
        WHERE pc.context_id = ?
      `);
            const result = stmt.get(contextId);
            if (!result)
                return null;
            return {
                expertise: JSON.parse(result.expertise || '[]'),
                tools: JSON.parse(result.tools || '[]'),
                restrictions: JSON.parse(result.restrictions || '[]'),
                performance_metrics: result.performance_metrics ? JSON.parse(result.performance_metrics) : undefined,
                learning_capabilities: result.learning_capabilities ? JSON.parse(result.learning_capabilities) : undefined
            };
        }
        catch (error) {
            this.logger.error('Failed to get persona capabilities', {
                method: 'getPersonaCapabilities',
                operation: 'get_persona_capabilities',
                metadata: { context_id: contextId }
            }, error);
            return null;
        }
    }
    /**
     * ペルソナ能力の更新
     */
    updatePersonaCapabilities(contextId, capabilities) {
        try {
            const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO persona_capabilities (
          context_id, expertise, tools, restrictions, 
          performance_metrics, learning_capabilities, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `);
            stmt.run(contextId, JSON.stringify(capabilities.expertise), JSON.stringify(capabilities.tools), JSON.stringify(capabilities.restrictions), capabilities.performance_metrics ? JSON.stringify(capabilities.performance_metrics) : null, capabilities.learning_capabilities ? JSON.stringify(capabilities.learning_capabilities) : null);
            this.logger.info(`Updated persona capabilities for context ${contextId}`, {
                method: 'updatePersonaCapabilities',
                contextId: contextId,
                operation: 'persona_capabilities_update_success'
            });
            return true;
        }
        catch (error) {
            this.logger.error('Failed to update persona capabilities', {
                method: 'updatePersonaCapabilities',
                operation: 'update_persona_capabilities',
                metadata: { context_id: contextId }
            }, error);
            return false;
        }
    }
    /**
     * ロール権限の確認
     */
    checkRolePermissions(contextId, requiredPermission) {
        try {
            const stmt = this.db.prepare(`
        SELECT permissions FROM persona_roles WHERE context_id = ?
      `);
            const result = stmt.get(contextId);
            if (!result)
                return false;
            const permissions = JSON.parse(result.permissions || '[]');
            return permissions.includes(requiredPermission) || permissions.includes('admin');
        }
        catch (error) {
            this.logger.error('Failed to check role permissions', {
                method: 'checkRolePermissions',
                operation: 'check_role_permissions',
                metadata: { context_id: contextId, required_permission: requiredPermission }
            }, error);
            return false;
        }
    }
    /**
     * タスク委譲の作成
     */
    createTaskDelegation(delegation) {
        const methodName = 'createTaskDelegation';
        const startTime = Date.now();
        try {
            this.logger.debug('Starting task delegation creation', {
                method: methodName,
                operation: 'pre_validation',
                metadata: {
                    from_context_id: delegation.from_context_id,
                    to_context_id: delegation.to_context_id,
                    task_description: delegation.task_description
                }
            });
            // 外部キー制約を事前にチェック（context_idの存在確認）
            const fromContextExists = this.db.prepare(`
        SELECT 1 FROM persona_capabilities WHERE context_id = ?
      `).get(delegation.from_context_id);
            const toContextExists = this.db.prepare(`
        SELECT 1 FROM persona_capabilities WHERE context_id = ?
      `).get(delegation.to_context_id);
            const checkResults = {
                from_exists: !!fromContextExists,
                to_exists: !!toContextExists
            };
            if (!fromContextExists || !toContextExists) {
                this.logger.logForeignKeyError(methodName, delegation.from_context_id, delegation.to_context_id, checkResults);
                return null;
            }
            const delegationId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            this.logger.debug('Foreign key validation passed, creating delegation', {
                method: methodName,
                operation: 'database_insert',
                metadata: {
                    delegation_id: delegationId,
                    foreign_key_check: checkResults
                }
            });
            const stmt = this.db.prepare(`
        INSERT INTO task_delegations (
          delegation_id, from_context_id, to_context_id, task_description,
          required_capabilities, priority_level, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `);
            stmt.run(delegationId, delegation.from_context_id, delegation.to_context_id, delegation.task_description, JSON.stringify(delegation.required_capabilities), delegation.priority_level, delegation.status);
            this.logger.logDatabaseOperation(methodName, 'task_delegation_insert', true, delegationId, {
                from_context_id: delegation.from_context_id,
                to_context_id: delegation.to_context_id,
                priority_level: delegation.priority_level,
                status: delegation.status
            });
            this.logger.logPerformance(methodName, 'task_delegation_creation', startTime, delegationId);
            this.logger.info(`Created task delegation: ${delegationId}`, {
                method: methodName,
                contextId: delegationId,
                operation: 'task_delegation_creation_success'
            });
            return delegationId;
        }
        catch (error) {
            this.logger.error('Failed to create task delegation', {
                method: methodName,
                operation: 'task_delegation_creation',
                metadata: {
                    from_context_id: delegation.from_context_id,
                    to_context_id: delegation.to_context_id,
                    task_description: delegation.task_description
                }
            }, error);
            return null;
        }
    }
    /**
     * 適切なペルソナの検索
     */
    findSuitablePersona(requiredCapabilities, excludeContextIds = []) {
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
            const result = stmt.get(...params);
            return result?.context_id || null;
        }
        catch (error) {
            console.error('❌ Failed to find suitable persona:', error);
            return null;
        }
    }
    /**
     * プロンプト最適化（セキュリティチェック付き）
     */
    optimizePromptForPersona(contextId, basePrompt, options = {}) {
        const appliedOptimizations = [];
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
                compression_level: 'medium',
                include_expertise_only: false,
                include_tools_only: false
            };
            optimizedPrompt = promptTokenManager.optimizePrompt(basePrompt, compressed, optimizationOptions);
            appliedOptimizations.push('capability_optimization');
        }
        // 3. トークン分析
        const tokenAnalysis = promptTokenManager.analyzePromptTokens(optimizedPrompt, options.model || 'gpt-4');
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
    recordPersonaLineage(parentContextId, childContextId, relationshipType) {
        try {
            const stmt = this.db.prepare(`
        INSERT INTO persona_lineage (
          parent_context_id, child_context_id, relationship_type, created_at
        ) VALUES (?, ?, ?, datetime('now'))
      `);
            stmt.run(parentContextId, childContextId, relationshipType);
            this.logger.info(`Recorded persona lineage: ${parentContextId} -> ${childContextId} (${relationshipType})`, {
                method: 'recordPersonaLineage',
                contextId: parentContextId,
                operation: 'persona_lineage_record_success',
                metadata: {
                    child_context_id: childContextId,
                    relationship_type: relationshipType
                }
            });
            return true;
        }
        catch (error) {
            console.error('❌ Failed to record persona lineage:', error);
            return false;
        }
    }
    /**
     * ペルソナのマージ実行
     */
    mergePersonas(sourceContextIds, targetContextId, strategy = 'union') {
        try {
            this.db.transaction(() => {
                // 1. ソースペルソナの能力取得
                const sourceCapabilities = sourceContextIds.map(id => this.getPersonaCapabilities(id))
                    .filter(cap => cap !== null);
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
                auditStmt.run(JSON.stringify(sourceContextIds), targetContextId, strategy, JSON.stringify(mergedCapabilities));
                // 5. 系譜記録
                sourceContextIds.forEach(sourceId => {
                    this.recordPersonaLineage(sourceId, targetContextId, 'merged');
                });
            })();
            this.logger.info(`Successfully merged personas into ${targetContextId}`, {
                method: 'mergePersonas',
                contextId: targetContextId,
                operation: 'persona_merge_success'
            });
            return true;
        }
        catch (error) {
            console.error('❌ Failed to merge personas:', error);
            return false;
        }
    }
    /**
     * 能力マージの実行
     */
    executeCapabilityMerge(capabilities, strategy) {
        switch (strategy) {
            case 'union':
                return {
                    expertise: [...new Set(capabilities.flatMap(c => safeGetStringArray(c.expertise)))],
                    tools: [...new Set(capabilities.flatMap(c => safeGetStringArray(c.tools)))],
                    restrictions: [...new Set(capabilities.flatMap(c => safeGetStringArray(c.restrictions)))]
                };
            case 'intersection':
                const firstCap = capabilities[0];
                const firstExpertise = safeGetStringArray(firstCap.expertise);
                const firstTools = safeGetStringArray(firstCap.tools);
                const firstRestrictions = safeGetStringArray(firstCap.restrictions);
                return {
                    expertise: firstExpertise.filter(exp => capabilities.every(c => safeGetStringArray(c.expertise).includes(exp))),
                    tools: firstTools.filter(tool => capabilities.every(c => safeGetStringArray(c.tools).includes(tool))),
                    restrictions: firstRestrictions.filter(res => capabilities.every(c => safeGetStringArray(c.restrictions).includes(res)))
                };
            case 'weighted_average':
                // 重み付き平均（簡易実装）
                const allExpertise = capabilities.flatMap(c => safeGetStringArray(c.expertise));
                const allTools = capabilities.flatMap(c => safeGetStringArray(c.tools));
                const weightedExpertise = this.getTopSkills(allExpertise, 10);
                const weightedTools = this.getTopSkills(allTools, 15);
                return {
                    expertise: weightedExpertise,
                    tools: weightedTools,
                    restrictions: [...new Set(capabilities.flatMap(c => safeGetStringArray(c.restrictions)))]
                };
            default:
                return capabilities[0];
        }
    }
    /**
     * 使用頻度に基づくトップスキル抽出
     */
    getTopSkills(skills, limit) {
        const frequency = skills.reduce((acc, skill) => {
            acc[skill] = (acc[skill] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(frequency)
            .sort(([, a], [, b]) => b - a)
            .slice(0, limit)
            .map(([skill]) => skill);
    }
    /**
     * ペルソナ統計の取得
     */
    getPersonaStatistics() {
        try {
            const totalPersonas = this.db.prepare('SELECT COUNT(*) as count FROM persona_capabilities').get();
            const activeDelegations = this.db.prepare("SELECT COUNT(*) as count FROM task_delegations WHERE status IN ('pending', 'in_progress')").get();
            const mergeOperations = this.db.prepare('SELECT COUNT(*) as count FROM persona_lineage').get();
            return {
                total_personas: totalPersonas.count,
                active_delegations: activeDelegations.count,
                merge_operations: mergeOperations.count,
                security_incidents: 0 // TODO: セキュリティインシデント追跡実装
            };
        }
        catch (error) {
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
    createRoleHierarchy(parentRoleId, childRoleId, contextId, roleType, permissions, description) {
        try {
            let parentLevel = 0;
            let actualParentRoleId = null;
            // 親ロールが指定されている場合のみ階層レベルを取得
            if (parentRoleId && parentRoleId.trim() !== '') {
                const parentRole = this.db.prepare('SELECT hierarchy_level FROM persona_roles WHERE role_id = ?').get(parentRoleId);
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
            stmt.run(childRoleId, contextId, roleType, JSON.stringify(permissions), description || '', actualParentRoleId, parentLevel + 1);
            this.logger.info(`Created role hierarchy: ${parentRoleId || 'root'} -> ${childRoleId}`, {
                method: 'createRoleHierarchy',
                contextId: childRoleId,
                operation: 'role_hierarchy_creation_success',
                metadata: {
                    parent_role_id: parentRoleId,
                    role_type: roleType
                }
            });
            return true;
        }
        catch (error) {
            console.error('❌ Failed to create role hierarchy:', error);
            return false;
        }
    }
    /**
     * タスク委譲状況監視 - 新機能
     */
    getDelegationStatus(delegationId) {
        try {
            const stmt = this.db.prepare(`
        SELECT status, result_data, delegation_metadata, 
               created_at, started_at, completed_at
        FROM task_delegations 
        WHERE delegation_id = ?
      `);
            const result = stmt.get(delegationId);
            if (!result)
                return null;
            const metadata = result.delegation_metadata ? JSON.parse(result.delegation_metadata) : {};
            const progress = this.calculateProgress(result.status, metadata);
            return {
                status: result.status,
                progress,
                estimated_completion: metadata.estimated_completion ? new Date(metadata.estimated_completion) : undefined,
                current_step: metadata.current_step
            };
        }
        catch (error) {
            console.error('❌ Failed to get delegation status:', error);
            return null;
        }
    }
    /**
     * 人格系譜分析 - 新機能
     */
    analyzePersonaLineage(contextId) {
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
        }
        catch (error) {
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
    smartDelegateTask(fromContextId, taskDescription, requiredCapabilities, options = {}) {
        try {
            // 候補ペルソナを能力でランク付け
            const candidates = this.rankCandidatesByCapability(requiredCapabilities, [fromContextId], // 自分自身は除外
            options);
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
                this.logger.info(`Smart delegation created: ${delegationId} -> ${bestCandidate.context_id} (match: ${bestCandidate.capability_score}%)`, {
                    method: 'smartTaskDelegation',
                    contextId: delegationId,
                    operation: 'smart_delegation_success',
                    metadata: {
                        target_context_id: bestCandidate.context_id,
                        capability_score: bestCandidate.capability_score
                    }
                });
            }
            return delegationId;
        }
        catch (error) {
            console.error('❌ Failed to smart delegate task:', error);
            return null;
        }
    }
    // === プライベートヘルパーメソッド ===
    calculateProgress(status, metadata) {
        const statusProgress = {
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
    getPersonaAncestors(contextId, depth, maxDepth = 5) {
        if (depth > maxDepth)
            return [];
        const stmt = this.db.prepare(`
      SELECT parent_context_id, merge_strategy
      FROM persona_lineage 
      WHERE child_context_id = ? AND is_active = 1
    `);
        const parents = stmt.all(contextId);
        const result = [];
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
    getPersonaDescendants(contextId, depth, maxDepth = 5) {
        if (depth > maxDepth)
            return [];
        const stmt = this.db.prepare(`
      SELECT child_context_id, merge_strategy
      FROM persona_lineage 
      WHERE parent_context_id = ? AND is_active = 1
    `);
        const children = stmt.all(contextId);
        const result = [];
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
    calculateLineageStrength(ancestors, descendants) {
        const totalConnections = ancestors.length + descendants.length;
        const weightedConnections = ancestors.reduce((sum, a) => sum + (1 / a.depth), 0) +
            descendants.reduce((sum, d) => sum + (1 / d.depth), 0);
        return Math.min(Math.round((weightedConnections / Math.max(totalConnections, 1)) * 100), 100);
    }
    rankCandidatesByCapability(requiredCapabilities, excludeContextIds, options) {
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
            const candidates = stmt.all(...excludeContextIds);
            return candidates
                .map(candidate => {
                const expertise = JSON.parse(candidate.expertise || '[]');
                const tools = JSON.parse(candidate.tools || '[]');
                const allCapabilities = [...expertise, ...tools];
                // 能力一致スコア計算
                const matchCount = requiredCapabilities.filter(req => allCapabilities.some(cap => cap.toLowerCase().includes(req.toLowerCase()))).length;
                const capabilityScore = Math.round((matchCount / requiredCapabilities.length) * 100);
                const loadFactor = candidate.current_load || 0;
                return {
                    context_id: candidate.context_id,
                    capability_score: capabilityScore,
                    load_factor: loadFactor
                };
            })
                .filter(candidate => candidate.capability_score >= (options.min_capability_match || 30))
                .sort((a, b) => {
                // 能力スコア優先、負荷考慮
                const scoreA = a.capability_score - (a.load_factor * 5);
                const scoreB = b.capability_score - (b.load_factor * 5);
                return scoreB - scoreA;
            })
                .slice(0, options.max_candidates || 5);
        }
        catch (error) {
            console.error('❌ Failed to rank candidates:', error);
            return [];
        }
    }
    /**
     * 人格側共有メモリ機能: MCPツール連携
     */
    async createSharedMemory(contextId, title, content, permissionLevel = 'public') {
        try {
            // 既存のSharedMemoryMCPToolsの機能を呼び出し
            if (global.sharedMemoryTools) {
                const result = await global.sharedMemoryTools.handleToolCall('shared-memory-create', {
                    title,
                    content,
                    creator_persona_id: contextId, // パラメータ名修正
                    permission_level: permissionLevel
                });
                this.logger.info(`Created shared memory for persona ${contextId}`, {
                    method: 'createSharedMemory',
                    contextId: contextId,
                    operation: 'shared_memory_create_success'
                });
                return result?.content?.[0]?.text?.match(/ID: ([a-f0-9-]+)/)?.[1] || null;
            }
            return null;
        }
        catch (error) {
            this.logger.error('Failed to create shared memory', {
                method: 'createSharedMemory',
                operation: 'create_shared_memory',
                metadata: { context_id: contextId }
            }, error);
            return null;
        }
    }
    async searchSharedMemory(contextId, keyword) {
        try {
            if (global.sharedMemoryTools) {
                const result = await global.sharedMemoryTools.handleToolCall('shared-memory-search', {
                    query: keyword, // パラメータ名修正
                    requester_persona_id: contextId
                });
                // 結果の解析とフォーマット
                const content = result?.content?.[0]?.text || '[]';
                const memories = JSON.parse(content);
                this.logger.info(`Searched shared memory for persona ${contextId}`, {
                    method: 'searchSharedMemory',
                    contextId: contextId,
                    operation: 'shared_memory_search_success',
                    metadata: { result_count: memories.length }
                });
                return memories;
            }
            return [];
        }
        catch (error) {
            this.logger.error('Failed to search shared memory', {
                method: 'searchSharedMemory',
                operation: 'search_shared_memory',
                metadata: { context_id: contextId }
            }, error);
            return [];
        }
    }
    async updateSharedMemory(contextId, memoryId, title, content) {
        try {
            if (global.sharedMemoryTools) {
                const updateData = { id: memoryId, updater_persona_id: contextId }; // パラメータ名修正: id
                if (title)
                    updateData.title = title;
                if (content)
                    updateData.content = content;
                await global.sharedMemoryTools.handleToolCall('shared-memory-update', updateData);
                this.logger.info(`Updated shared memory for persona ${contextId}`, {
                    method: 'updateSharedMemory',
                    contextId: contextId,
                    operation: 'shared_memory_update_success'
                });
                return true;
            }
            return false;
        }
        catch (error) {
            this.logger.error('Failed to update shared memory', {
                method: 'updateSharedMemory',
                operation: 'update_shared_memory',
                metadata: { context_id: contextId, memory_id: memoryId }
            }, error);
            return false;
        }
    }
    async deleteSharedMemory(contextId, memoryId) {
        try {
            if (global.sharedMemoryTools) {
                await global.sharedMemoryTools.handleToolCall('shared-memory-delete', {
                    id: memoryId, // パラメータ名修正: id
                    deleter_persona_id: contextId // パラメータ名修正
                });
                this.logger.info(`Deleted shared memory for persona ${contextId}`, {
                    method: 'deleteSharedMemory',
                    contextId: contextId,
                    operation: 'shared_memory_delete_success'
                });
                return true;
            }
            return false;
        }
        catch (error) {
            this.logger.error('Failed to delete shared memory', {
                method: 'deleteSharedMemory',
                operation: 'delete_shared_memory',
                metadata: { context_id: contextId, memory_id: memoryId }
            }, error);
            return false;
        }
    }
    /**
     * 人格側BIFF通知: 会話履歴にシステムロールメッセージとして通知を挿入
     */
    async insertBiffNotification(contextId) {
        try {
            if (global.sharedMemoryTools) {
                const result = await global.sharedMemoryTools.handleToolCall('shared-memory-notifications', {
                    persona_id: contextId // パラメータ名修正: persona_id
                });
                const content = result?.content?.[0]?.text || '';
                if (content && content !== 'No new notifications') {
                    // 通知をシステムロールメッセージ形式でフォーマット
                    const systemMessage = `📬 共有メモリ通知: ${content}`;
                    this.logger.info(`Generated BIFF notification for persona ${contextId}`, {
                        method: 'insertBiffNotification',
                        contextId: contextId,
                        operation: 'biff_notification_success'
                    });
                    return systemMessage;
                }
                return null;
            }
            return null;
        }
        catch (error) {
            this.logger.error('Failed to generate BIFF notification', {
                method: 'insertBiffNotification',
                operation: 'biff_notification',
                metadata: { context_id: contextId }
            }, error);
            return null;
        }
    }
    /**
     * 人格用会話履歴にBIFF通知を挿入
     */
    async enrichConversationWithBiff(contextId, messages) {
        try {
            const biffNotification = await this.insertBiffNotification(contextId);
            if (biffNotification) {
                // 会話履歴の最初にシステムロールメッセージとして挿入
                const enrichedMessages = [
                    { role: 'system', content: biffNotification },
                    ...messages
                ];
                this.logger.info(`Enriched conversation with BIFF notification for persona ${contextId}`, {
                    method: 'enrichConversationWithBiff',
                    contextId: contextId,
                    operation: 'conversation_biff_enrichment_success'
                });
                return enrichedMessages;
            }
            return messages;
        }
        catch (error) {
            this.logger.error('Failed to enrich conversation with BIFF', {
                method: 'enrichConversationWithBiff',
                operation: 'conversation_biff_enrichment',
                metadata: { context_id: contextId }
            }, error);
            return messages;
        }
    }
}
