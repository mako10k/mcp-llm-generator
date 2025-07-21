/**
 * Step3: 能力自覚・他覚システム実装
 * 
 * 既存のpersona_hierarchyテーブルと統合して、各人格が：
 * 1. 自己能力を認識する（自覚機能）
 * 2. 他人格の能力を観察・評価する（他覚機能）
 * 3. 親から子への能力継承を管理する（継承機能）
 */

import Database from 'better-sqlite3';
import { z } from 'zod';

// 能力情報のスキーマ定義
const CapabilitySchema = z.object({
  expertise: z.array(z.string()).default([]),
  tools: z.array(z.string()).default([]),
  restrictions: z.array(z.string()).default([]),
  performance_metrics: z.string().optional(),
  learning_capabilities: z.string().optional(),
  hierarchy_level: z.number().default(0),
  inherited_from: z.array(z.string()).default([]) // 継承元の人格ID
});

const SelfAwarenessInfoSchema = z.object({
  context_id: z.string(),
  own_capabilities: CapabilitySchema,
  position_in_hierarchy: z.object({
    ancestors: z.array(z.string()),
    descendants: z.array(z.string()),
    depth: z.number(),
    is_root: z.boolean(),
    is_leaf: z.boolean()
  }),
  responsibilities: z.array(z.string()).default([]),
  constraints: z.array(z.string()).default([]),
  available_actions: z.array(z.string()).default([])
});

const OtherAwarenessInfoSchema = z.object({
  target_context_id: z.string(),
  observer_context_id: z.string(),
  observable_capabilities: CapabilitySchema,
  relationship: z.enum(['parent', 'child', 'sibling', 'descendant', 'ancestor', 'unrelated']),
  interaction_history: z.array(z.any()).default([]),
  assessment: z.object({
    strengths: z.array(z.string()).default([]),
    limitations: z.array(z.string()).default([]),
    recommended_tasks: z.array(z.string()).default([])
  }).optional()
});

export type CapabilityInfo = z.infer<typeof CapabilitySchema>;
export type SelfAwarenessInfo = z.infer<typeof SelfAwarenessInfoSchema>;
export type OtherAwarenessInfo = z.infer<typeof OtherAwarenessInfoSchema>;

export class CapabilityAwarenessService {
  private db: Database.Database;
  private queries: any = {};

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.initializeQueries();
  }

  private initializeQueries() {
    // プリコンパイルクエリの準備
    this.queries = {
      getPersonaCapabilities: this.db.prepare(`
        SELECT * FROM persona_capabilities WHERE context_id = ?
      `),
      
      getHierarchyPosition: this.db.prepare(`
        SELECT 
          ancestor_id,
          descendant_id,
          depth,
          is_direct
        FROM persona_hierarchy 
        WHERE ancestor_id = ? OR descendant_id = ?
      `),
      
      getAncestors: this.db.prepare(`
        SELECT ancestor_id, depth 
        FROM persona_hierarchy 
        WHERE descendant_id = ? AND depth > 0
        ORDER BY depth ASC
      `),
      
      getDescendants: this.db.prepare(`
        SELECT descendant_id, depth 
        FROM persona_hierarchy 
        WHERE ancestor_id = ? AND depth > 0
        ORDER BY depth ASC
      `),
      
      getDirectChildren: this.db.prepare(`
        SELECT descendant_id 
        FROM persona_hierarchy 
        WHERE ancestor_id = ? AND depth = 1
      `),
      
      getDirectParent: this.db.prepare(`
        SELECT ancestor_id 
        FROM persona_hierarchy 
        WHERE descendant_id = ? AND depth = 1
      `),
      
      getSiblings: this.db.prepare(`
        SELECT ph2.descendant_id 
        FROM persona_hierarchy ph1
        JOIN persona_hierarchy ph2 ON ph1.ancestor_id = ph2.ancestor_id
        WHERE ph1.descendant_id = ? 
        AND ph1.depth = 1 AND ph2.depth = 1 
        AND ph2.descendant_id != ?
      `),
      
      updateInheritedCapabilities: this.db.prepare(`
        UPDATE persona_capabilities 
        SET 
          expertise = ?,
          tools = ?,
          restrictions = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE context_id = ?
      `)
    };
  }

  /**
   * Step3-1: 自覚機能実装
   * 指定された人格が自身の能力・制約・責務を理解する
   */
  async getSelfAwareness(contextId: string): Promise<SelfAwarenessInfo> {
    try {
      // 1. 自身の能力情報を取得
      const capabilities = this.queries.getPersonaCapabilities.get(contextId);
      if (!capabilities) {
        throw new Error(`Persona capabilities not found for context: ${contextId}`);
      }

      // 2. 階層位置情報を取得
      const hierarchyPosition = await this.getHierarchyPosition(contextId);
      
      // 3. 自覚情報を構築
      const selfAwareness: SelfAwarenessInfo = {
        context_id: contextId,
        own_capabilities: {
          expertise: this.parseJsonArray(capabilities.expertise),
          tools: this.parseJsonArray(capabilities.tools),
          restrictions: this.parseJsonArray(capabilities.restrictions),
          performance_metrics: capabilities.performance_metrics,
          learning_capabilities: capabilities.learning_capabilities,
          hierarchy_level: hierarchyPosition.depth,
          inherited_from: await this.getInheritanceSources(contextId)
        },
        position_in_hierarchy: hierarchyPosition,
        responsibilities: await this.calculateResponsibilities(contextId, hierarchyPosition),
        constraints: await this.calculateConstraints(contextId, hierarchyPosition),
        available_actions: await this.calculateAvailableActions(contextId, hierarchyPosition)
      };

      return SelfAwarenessInfoSchema.parse(selfAwareness);
    } catch (error) {
      console.error('Error in getSelfAwareness:', error);
      throw error;
    }
  }

  /**
   * Step3-2: 他覚機能実装
   * 指定された観察者人格が他の人格の能力を観察・評価する
   */
  async getOtherAwareness(observerContextId: string, targetContextId: string): Promise<OtherAwarenessInfo> {
    try {
      // 1. 対象人格の能力情報を取得（観察可能な範囲のみ）
      const targetCapabilities = await this.getObservableCapabilities(observerContextId, targetContextId);
      
      // 2. 関係性を判定
      const relationship = await this.determineRelationship(observerContextId, targetContextId);
      
      // 3. 他覚情報を構築
      const otherAwareness: OtherAwarenessInfo = {
        target_context_id: targetContextId,
        observer_context_id: observerContextId,
        observable_capabilities: targetCapabilities,
        relationship: relationship,
        interaction_history: await this.getInteractionHistory(observerContextId, targetContextId),
        assessment: await this.generateAssessment(observerContextId, targetContextId, relationship)
      };

      return OtherAwarenessInfoSchema.parse(otherAwareness);
    } catch (error) {
      console.error('Error in getOtherAwareness:', error);
      throw error;
    }
  }

  /**
   * Step3-3: 継承機能実装
   * 親から子への能力継承（制限付き）を処理する
   */
  async processCapabilityInheritance(parentContextId: string, childContextId: string): Promise<void> {
    try {
      // 1. 親子関係を確認
      const isDirectChild = this.queries.getDirectChildren.get(parentContextId)
        ?.find((child: any) => child.descendant_id === childContextId);
      
      if (!isDirectChild) {
        throw new Error(`${childContextId} is not a direct child of ${parentContextId}`);
      }

      // 2. 親の能力を取得
      const parentCapabilities = this.queries.getPersonaCapabilities.get(parentContextId);
      if (!parentCapabilities) {
        throw new Error(`Parent capabilities not found: ${parentContextId}`);
      }

      // 3. 子の現在の能力を取得
      const childCapabilities = this.queries.getPersonaCapabilities.get(childContextId);
      if (!childCapabilities) {
        throw new Error(`Child capabilities not found: ${childContextId}`);
      }

      // 4. 継承ルールを適用
      const inheritedCapabilities = await this.applyInheritanceRules(
        parentCapabilities,
        childCapabilities,
        parentContextId,
        childContextId
      );

      // 5. 子の能力を更新
      this.queries.updateInheritedCapabilities.run(
        JSON.stringify(inheritedCapabilities.expertise),
        JSON.stringify(inheritedCapabilities.tools),
        JSON.stringify(inheritedCapabilities.restrictions),
        childContextId
      );

      console.log(`Capability inheritance completed: ${parentContextId} -> ${childContextId}`);
    } catch (error) {
      console.error('Error in processCapabilityInheritance:', error);
      throw error;
    }
  }

  // ヘルパーメソッド群

  private async getHierarchyPosition(contextId: string) {
    const ancestors = this.queries.getAncestors.all(contextId);
    const descendants = this.queries.getDescendants.all(contextId);
    
    return {
      ancestors: ancestors.map((a: any) => a.ancestor_id),
      descendants: descendants.map((d: any) => d.descendant_id),
      depth: ancestors.length,
      is_root: ancestors.length === 0,
      is_leaf: descendants.length === 0
    };
  }

  private async getInheritanceSources(contextId: string): Promise<string[]> {
    const ancestors = this.queries.getAncestors.all(contextId);
    return ancestors.map((a: any) => a.ancestor_id);
  }

  private async calculateResponsibilities(contextId: string, hierarchyPosition: any): Promise<string[]> {
    const responsibilities: string[] = [];
    
    if (hierarchyPosition.is_root) {
      responsibilities.push('Top-level decision making', 'System oversight');
    }
    
    if (hierarchyPosition.descendants.length > 0) {
      responsibilities.push('Child persona management', 'Task delegation');
    }
    
    if (hierarchyPosition.is_leaf) {
      responsibilities.push('Specialized task execution', 'Detailed implementation');
    }
    
    return responsibilities;
  }

  private async calculateConstraints(contextId: string, hierarchyPosition: any): Promise<string[]> {
    const constraints: string[] = [];
    
    if (!hierarchyPosition.is_root) {
      constraints.push('Must respect parent persona decisions');
    }
    
    if (hierarchyPosition.depth > 2) {
      constraints.push('Limited autonomy due to deep hierarchy');
    }
    
    return constraints;
  }

  private async calculateAvailableActions(contextId: string, hierarchyPosition: any): Promise<string[]> {
    const actions: string[] = [];
    
    actions.push('Self-assessment', 'Capability evaluation');
    
    if (hierarchyPosition.descendants.length > 0) {
      actions.push('Child persona creation', 'Task delegation');
    }
    
    if (!hierarchyPosition.is_root) {
      actions.push('Report to parent', 'Request assistance');
    }
    
    return actions;
  }

  private async getObservableCapabilities(observerContextId: string, targetContextId: string): Promise<CapabilityInfo> {
    const targetCapabilities = this.queries.getPersonaCapabilities.get(targetContextId);
    if (!targetCapabilities) {
      throw new Error(`Target capabilities not found: ${targetContextId}`);
    }

    // 観察者の権限に基づいて表示可能な情報を制限
    const relationship = await this.determineRelationship(observerContextId, targetContextId);
    
    if (relationship === 'unrelated') {
      // 無関係な人格の場合は公開情報のみ
      return {
        expertise: targetCapabilities.is_public ? this.parseJsonArray(targetCapabilities.expertise) : [],
        tools: [],
        restrictions: [],
        hierarchy_level: 0,
        inherited_from: []
      };
    }
    
    // 関係がある場合は詳細情報を提供
    return {
      expertise: this.parseJsonArray(targetCapabilities.expertise),
      tools: this.parseJsonArray(targetCapabilities.tools),
      restrictions: this.parseJsonArray(targetCapabilities.restrictions),
      performance_metrics: targetCapabilities.performance_metrics,
      learning_capabilities: targetCapabilities.learning_capabilities,
      hierarchy_level: 0, // TODO: 階層レベルを計算
      inherited_from: await this.getInheritanceSources(targetContextId)
    };
  }

  private async determineRelationship(observerContextId: string, targetContextId: string): Promise<'parent' | 'child' | 'sibling' | 'descendant' | 'ancestor' | 'unrelated'> {
    // 直接の親子関係をチェック
    const isDirectParent = this.queries.getDirectParent.get(targetContextId)?.ancestor_id === observerContextId;
    const isDirectChild = this.queries.getDirectChildren.get(observerContextId)
      ?.find((child: any) => child.descendant_id === targetContextId);
    
    if (isDirectParent) return 'parent';
    if (isDirectChild) return 'child';
    
    // 兄弟関係をチェック
    const siblings = this.queries.getSiblings.all(observerContextId, observerContextId);
    const isSibling = siblings.find((sibling: any) => sibling.descendant_id === targetContextId);
    if (isSibling) return 'sibling';
    
    // 祖先・子孫関係をチェック
    const observerAncestors = this.queries.getAncestors.all(observerContextId);
    const observerDescendants = this.queries.getDescendants.all(observerContextId);
    
    const isAncestor = observerAncestors.find((a: any) => a.ancestor_id === targetContextId);
    const isDescendant = observerDescendants.find((d: any) => d.descendant_id === targetContextId);
    
    if (isAncestor) return 'ancestor';
    if (isDescendant) return 'descendant';
    
    return 'unrelated';
  }

  private async getInteractionHistory(observerContextId: string, targetContextId: string): Promise<any[]> {
    // TODO: タスク委譲履歴などから相互作用履歴を構築
    return [];
  }

  private async generateAssessment(observerContextId: string, targetContextId: string, relationship: string): Promise<{ strengths: string[], limitations: string[], recommended_tasks: string[] }> {
    // TODO: 関係性と能力情報に基づいて評価を生成
    return {
      strengths: [],
      limitations: [],
      recommended_tasks: []
    };
  }

  private async applyInheritanceRules(
    parentCapabilities: any,
    childCapabilities: any,
    parentContextId: string,
    childContextId: string
  ): Promise<CapabilityInfo> {
    const parentExpertise = this.parseJsonArray(parentCapabilities.expertise);
    const parentTools = this.parseJsonArray(parentCapabilities.tools);
    const parentRestrictions = this.parseJsonArray(parentCapabilities.restrictions);
    
    const childExpertise = this.parseJsonArray(childCapabilities.expertise);
    const childTools = this.parseJsonArray(childCapabilities.tools);
    const childRestrictions = this.parseJsonArray(childCapabilities.restrictions);
    
    // 継承ルール：
    // 1. 専門知識は50%継承
    // 2. ツールは親のサブセットのみ継承可能
    // 3. 制約は完全継承（子はより制約される）
    
    const inheritedExpertise = [...new Set([
      ...childExpertise,
      ...parentExpertise.slice(0, Math.ceil(parentExpertise.length * 0.5))
    ])];
    
    const inheritedTools = [...new Set([
      ...childTools,
      ...parentTools.filter(tool => childTools.includes(tool) || parentTools.length <= 5)
    ])];
    
    const inheritedRestrictions = [...new Set([
      ...childRestrictions,
      ...parentRestrictions
    ])];
    
    return {
      expertise: inheritedExpertise,
      tools: inheritedTools,
      restrictions: inheritedRestrictions,
      hierarchy_level: 0, // TODO: 計算
      inherited_from: [parentContextId]
    };
  }

  private parseJsonArray(jsonString: string): string[] {
    try {
      const parsed = JSON.parse(jsonString || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  // サービス終了処理
  close(): void {
    this.db.close();
  }
}
