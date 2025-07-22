/**
 * Tool Description Builder
 * ツール記述生成のStrategy実装
 */

import { BasePromptSectionBuilder, BuilderConfig } from './PromptSectionBuilder.js';
import { PromptContext } from '../../types/prompt.js';
import { Tool } from '../../types/tool.js';
import { ParameterFormatter } from './ParameterFormatter.js';
import { ToolUsageHintGenerator } from '../utils/ToolUsageHintGenerator.js';

export class ToolDescriptionBuilder extends BasePromptSectionBuilder {
  constructor(config?: BuilderConfig) {
    super({
      enabled: true,
      priority: 8,
      maxLength: 2000,
      ...config
    });
  }

  getSectionName(): string {
    return 'Tool Descriptions';
  }

  build(context: PromptContext): string {
    if (context.availableTools.length === 0) {
      return 'No tools are currently available.';
    }

    const descriptions = context.availableTools.map(tool => 
      this.formatSingleTool(tool)
    ).join('\n\n');

    const content = `## Available Tools\n\n${descriptions}`;
    return this.truncateIfNeeded(content);
  }

  /**
   * 単一ツールのフォーマット
   */
  private formatSingleTool(tool: Tool): string {
    const func = tool.function;
    const { required, optional } = ParameterFormatter.classify(func.parameters);

    return `## ${func.name}
**Description**: ${func.description}

**Parameters**:
${ParameterFormatter.format(func.parameters, required, optional)}

**Usage**: Call this tool when ${ToolUsageHintGenerator.generateUsageHint(func)}`;
  }
}
