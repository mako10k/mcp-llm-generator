/**
 * Constraint Builder
 * 制約事項生成のStrategy実装
 */

import { BasePromptSectionBuilder, BuilderConfig } from './PromptSectionBuilder.js';
import { PromptContext } from '../../types/prompt.js';

export class ConstraintBuilder extends BasePromptSectionBuilder {
  private strictMode: boolean;
  private includeToolValidation: boolean;

  constructor(
    strictMode: boolean = true,
    includeToolValidation: boolean = true,
    config?: BuilderConfig
  ) {
    super({
      enabled: true,
      priority: 5,
      maxLength: 600,
      ...config
    });
    this.strictMode = strictMode;
    this.includeToolValidation = includeToolValidation;
  }

  getSectionName(): string {
    return 'Constraints';
  }

  build(context: PromptContext): string {
    const constraints: string[] = [];

    if (context.constraints?.maxTokens) {
      constraints.push(`- Maximum response tokens: ${context.constraints.maxTokens}`);
    }

    if (context.constraints?.allowedActions?.length) {
      constraints.push(`- Allowed actions: ${context.constraints.allowedActions.join(', ')}`);
    }

    if (context.constraints?.forbiddenActions?.length) {
      constraints.push(`- Forbidden actions: ${context.constraints.forbiddenActions.join(', ')}`);
    }

    if (this.strictMode) {
      constraints.push('- Strict schema compliance required');
      constraints.push('- No additional properties allowed in output');
    }

    if (this.includeToolValidation) {
      constraints.push('- All tool parameters must be validated');
      constraints.push('- Confidence scores must reflect actual certainty');
    }

    if (constraints.length === 0) {
      return '';
    }

    const content = `## Constraints\n\n${constraints.join('\n')}`;
    return this.truncateIfNeeded(content);
  }

  isRequired(): boolean {
    return false; // 制約がない場合は空文字列を返すため
  }
}
