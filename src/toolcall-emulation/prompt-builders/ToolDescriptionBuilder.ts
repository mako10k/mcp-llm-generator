/**
 * Tool Description Builder
 * ツール記述生成のStrategy実装
 */

import { BasePromptSectionBuilder, BuilderConfig } from './PromptSectionBuilder.js';
import { PromptContext } from '../../types/prompt.js';
import { Tool } from '../../types/tool.js';
import { ParameterFormatter } from './ParameterFormatter.js';

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

**Usage**: Call this tool when ${this.generateUsageHint(func)}`;
  }

  /**
   * 使用ヒントの生成
   */
  private generateUsageHint(func: any): string {
    const keywords = func.name.toLowerCase();
    
    if (keywords.includes('search')) return 'the user needs to find or search for information';
    if (keywords.includes('create')) return 'the user wants to create something new';
    if (keywords.includes('update')) return 'the user wants to modify existing data';
    if (keywords.includes('delete')) return 'the user wants to remove something';
    if (keywords.includes('get') || keywords.includes('fetch')) return 'the user needs to retrieve specific data';
    if (keywords.includes('send') || keywords.includes('notify')) return 'the user wants to communicate or send notifications';
    
    return 'the user\'s request matches this tool\'s functionality';
  }
}
