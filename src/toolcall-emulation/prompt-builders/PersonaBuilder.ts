/**
 * Persona Builder
 * 人格コンテキスト生成のStrategy実装
 */

import { BasePromptSectionBuilder, BuilderConfig } from './PromptSectionBuilder.js';
import { PromptContext } from '../../types/prompt.js';

export class PersonaBuilder extends BasePromptSectionBuilder {
  constructor(config?: BuilderConfig) {
    super({
      enabled: true,
      priority: 7,
      maxLength: 800,
      ...config
    });
  }

  getSectionName(): string {
    return 'Persona Context';
  }

  build(context: PromptContext): string {
    if (!context.persona) {
      return '';
    }

    const persona = context.persona;
    const content = `## Persona Context

You are operating with the following capabilities and constraints:

**Expertise Areas**: ${persona.expertise?.join(', ') || 'General'}
**Available Tools**: ${persona.tools?.join(', ') || 'All available'}
**Restrictions**: ${persona.restrictions?.join(', ') || 'None'}

Adapt your tool selection and reasoning to align with these persona characteristics.`;

    return this.truncateIfNeeded(content);
  }

  isRequired(): boolean {
    return false; // PersonaBuilderは必須ではない
  }
}
