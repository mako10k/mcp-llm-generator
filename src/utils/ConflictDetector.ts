// Step4マージ機能 - ConflictDetector
// 作成日: 2025年7月22日
// 目的: システムプロンプトと能力情報の矛盾検出エンジン

import { ConflictInfo, CapabilityInfo } from '../types/promptMerge.js';

/**
 * 矛盾検出エンジン
 * システムプロンプト、能力情報、タスクコンテキストの間の矛盾を検出
 */
export class ConflictDetector {
  
  /**
   * 包括的な矛盾検出処理
   */
  async detect(
    userPrompt: string, 
    capabilities: CapabilityInfo[], 
    taskContext?: string
  ): Promise<ConflictInfo[]> {
    const conflicts: ConflictInfo[] = [];

    // 1. 能力矛盾の検出
    conflicts.push(...await this.detectCapabilityConflicts(userPrompt, capabilities));

    // 2. 制約矛盾の検出
    conflicts.push(...await this.detectConstraintConflicts(userPrompt, capabilities));

    // 3. 言語混在の検出
    conflicts.push(...await this.detectLanguageMismatch(userPrompt, taskContext));

    // 4. タスクコンテキスト矛盾の検出
    if (taskContext) {
      conflicts.push(...await this.detectTaskContextConflicts(userPrompt, capabilities, taskContext));
    }

    return this.prioritizeConflicts(conflicts);
  }

  /**
   * 能力情報の矛盾検出
   */
  private async detectCapabilityConflicts(
    userPrompt: string, 
    capabilities: CapabilityInfo[]
  ): Promise<ConflictInfo[]> {
    const conflicts: ConflictInfo[] = [];
    const promptLower = userPrompt.toLowerCase();

    for (const capability of capabilities) {
      // 能力の否定表現チェック
      const negationPatterns = [
        `cannot ${capability.name.toLowerCase()}`,
        `can't ${capability.name.toLowerCase()}`,
        `unable to ${capability.name.toLowerCase()}`,
        `don't ${capability.name.toLowerCase()}`,
        `do not ${capability.name.toLowerCase()}`,
        `not allowed to ${capability.name.toLowerCase()}`
      ];

      for (const pattern of negationPatterns) {
        if (promptLower.includes(pattern)) {
          conflicts.push({
            type: 'capability_conflict',
            severity: 'error',
            description: `User prompt contradicts capability: ${capability.name}`,
            conflictingItems: [capability.name, pattern],
            suggestedResolution: `Remove conflicting statement about ${capability.name} or disable the capability`
          });
        }
      }

      // 能力制約の矛盾チェック
      for (const constraint of capability.constraints) {
        if (this.checkConstraintViolation(promptLower, constraint)) {
          conflicts.push({
            type: 'capability_conflict',
            severity: 'warning',
            description: `User prompt may violate capability constraint: ${constraint}`,
            conflictingItems: [capability.name, constraint],
            suggestedResolution: `Review and align prompt with capability constraints`
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * 制約の矛盾検出
   */
  private async detectConstraintConflicts(
    userPrompt: string, 
    capabilities: CapabilityInfo[]
  ): Promise<ConflictInfo[]> {
    const conflicts: ConflictInfo[] = [];
    const allConstraints = capabilities.flatMap(c => 
      c.constraints.map(constraint => ({ capability: c.name, constraint }))
    );

    // 制約間の相互矛盾をチェック
    for (let i = 0; i < allConstraints.length; i++) {
      for (let j = i + 1; j < allConstraints.length; j++) {
        const conflict = this.checkConstraintContradict(
          allConstraints[i],
          allConstraints[j]
        );

        if (conflict) {
          conflicts.push({
            type: 'constraint_contradiction',
            severity: 'error',
            description: `Contradictory constraints detected between capabilities`,
            conflictingItems: [
              `${allConstraints[i].capability}: ${allConstraints[i].constraint}`,
              `${allConstraints[j].capability}: ${allConstraints[j].constraint}`
            ],
            suggestedResolution: 'Review and resolve contradictory constraints'
          });
        }
      }
    }

    // プロンプト内の矛盾する指示をチェック
    const promptConflicts = this.detectPromptInternalConflicts(userPrompt);
    conflicts.push(...promptConflicts);

    return conflicts;
  }

  /**
   * 言語混在の検出
   */
  private async detectLanguageMismatch(
    userPrompt: string, 
    taskContext?: string
  ): Promise<ConflictInfo[]> {
    const conflicts: ConflictInfo[] = [];

    const promptLanguage = this.detectLanguage(userPrompt);
    const contextLanguage = taskContext ? this.detectLanguage(taskContext) : null;

    // 言語の不一致チェック
    if (contextLanguage && promptLanguage !== contextLanguage) {
      // 軽微な言語混在は警告レベル
      if (this.isMinorLanguageMismatch(promptLanguage, contextLanguage)) {
        conflicts.push({
          type: 'language_mismatch',
          severity: 'warning',
          description: `Language mismatch between prompt (${promptLanguage}) and context (${contextLanguage})`,
          conflictingItems: [promptLanguage, contextLanguage],
          suggestedResolution: 'Consider using consistent language throughout'
        });
      }
    }

    return conflicts;
  }

  /**
   * タスクコンテキストとの矛盾検出
   */
  private async detectTaskContextConflicts(
    userPrompt: string,
    capabilities: CapabilityInfo[],
    taskContext: string
  ): Promise<ConflictInfo[]> {
    const conflicts: ConflictInfo[] = [];

    // タスクコンテキストで要求される能力が無効化されているかチェック
    const requiredCapabilities = this.extractRequiredCapabilities(taskContext);
    const promptLower = userPrompt.toLowerCase();

    for (const requiredCap of requiredCapabilities) {
      // プロンプト内で無効化されているかチェック
      const isDisabled = this.isCapabilityDisabled(promptLower, requiredCap);
      if (isDisabled) {
        conflicts.push({
          type: 'capability_conflict',
          severity: 'error',
          description: `Task requires capability "${requiredCap}" but it's disabled in prompt`,
          conflictingItems: [requiredCap, 'user prompt restrictions'],
          suggestedResolution: `Enable "${requiredCap}" capability or modify task requirements`
        });
      }
    }

    return conflicts;
  }

  /**
   * 制約違反のチェック
   */
  private checkConstraintViolation(promptLower: string, constraint: string): boolean {
    const constraintLower = constraint.toLowerCase();
    
    // 一般的な制約違反パターン
    const violationPatterns = [
      // アクセス制限の違反
      { constraint: 'read-only', violation: 'write' },
      { constraint: 'no network', violation: 'connect' },
      { constraint: 'local only', violation: 'remote' },
      { constraint: 'safe mode', violation: 'execute' }
    ];

    for (const pattern of violationPatterns) {
      if (constraintLower.includes(pattern.constraint) && 
          promptLower.includes(pattern.violation)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 制約間の矛盾チェック
   */
  private checkConstraintContradict(
    constraint1: { capability: string; constraint: string },
    constraint2: { capability: string; constraint: string }
  ): boolean {
    const c1 = constraint1.constraint.toLowerCase();
    const c2 = constraint2.constraint.toLowerCase();

    // 矛盾パターンの検出
    const contradictionPairs = [
      ['read-only', 'write access'],
      ['no network', 'network required'],
      ['local only', 'remote access'],
      ['safe mode', 'unrestricted']
    ];

    for (const [pattern1, pattern2] of contradictionPairs) {
      if ((c1.includes(pattern1) && c2.includes(pattern2)) ||
          (c1.includes(pattern2) && c2.includes(pattern1))) {
        return true;
      }
    }

    return false;
  }

  /**
   * プロンプト内部の矛盾検出
   */
  private detectPromptInternalConflicts(userPrompt: string): ConflictInfo[] {
    const conflicts: ConflictInfo[] = [];
    const lines = userPrompt.split('\n');

    // 矛盾する指示の検出
    const contradictions = [
      { positive: 'always', negative: 'never' },
      { positive: 'must', negative: 'must not' },
      { positive: 'required', negative: 'forbidden' },
      { positive: 'enable', negative: 'disable' }
    ];

    for (const contradiction of contradictions) {
      const hasPositive = userPrompt.toLowerCase().includes(contradiction.positive);
      const hasNegative = userPrompt.toLowerCase().includes(contradiction.negative);

      if (hasPositive && hasNegative) {
        conflicts.push({
          type: 'constraint_contradiction',
          severity: 'warning',
          description: `Contradictory instructions in prompt: ${contradiction.positive} vs ${contradiction.negative}`,
          conflictingItems: [contradiction.positive, contradiction.negative],
          suggestedResolution: 'Clarify conflicting instructions in the prompt'
        });
      }
    }

    return conflicts;
  }

  /**
   * 言語検出（簡易版）
   */
  private detectLanguage(text: string): string {
    // 日本語文字の検出
    const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
    if (japaneseRegex.test(text)) return 'japanese';

    // 英語（デフォルト）
    return 'english';
  }

  /**
   * 軽微な言語混在の判定
   */
  private isMinorLanguageMismatch(lang1: string, lang2: string): boolean {
    // 日本語-英語混在は一般的なので軽微とみなす
    const commonMixtures = [
      ['japanese', 'english'],
      ['english', 'japanese']
    ];

    return commonMixtures.some(mix => 
      (mix[0] === lang1 && mix[1] === lang2) ||
      (mix[0] === lang2 && mix[1] === lang1)
    );
  }

  /**
   * タスクコンテキストから必要な能力を抽出
   */
  private extractRequiredCapabilities(taskContext: string): string[] {
    const context = taskContext.toLowerCase();
    const capabilities: string[] = [];

    // 一般的な能力キーワードの検出
    const capabilityKeywords = [
      'file-access', 'network', 'database', 'analysis', 'generation',
      'translation', 'calculation', 'visualization', 'debugging'
    ];

    for (const keyword of capabilityKeywords) {
      if (context.includes(keyword)) {
        capabilities.push(keyword);
      }
    }

    return capabilities;
  }

  /**
   * 能力が無効化されているかチェック
   */
  private isCapabilityDisabled(promptLower: string, capability: string): boolean {
    const disablePatterns = [
      `no ${capability}`,
      `disable ${capability}`,
      `without ${capability}`,
      `cannot ${capability}`
    ];

    return disablePatterns.some(pattern => promptLower.includes(pattern));
  }

  /**
   * 矛盾の優先度付け
   */
  private prioritizeConflicts(conflicts: ConflictInfo[]): ConflictInfo[] {
    return conflicts.sort((a, b) => {
      // 重要度順: critical > error > warning
      const severityOrder = { critical: 3, error: 2, warning: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }
}
