/**
 * Context Builder
 * コンテキスト情報生成のStrategy実装
 */

import { BasePromptSectionBuilder, BuilderConfig } from './PromptSectionBuilder.js';
import { PromptContext } from '../../types/prompt.js';

export class ContextBuilder extends BasePromptSectionBuilder {
  constructor(config?: BuilderConfig) {
    super({
      enabled: true,
      priority: 4,
      maxLength: 1000,
      ...config
    });
  }

  getSectionName(): string {
    return 'Context Information';
  }

  build(context: PromptContext): string {
    const info: string[] = [];

    // 会話履歴の追加
    if (context.conversationHistory?.length) {
      const recentHistory = context.conversationHistory.slice(-3);
      info.push('**Recent Conversation**:');
      recentHistory.forEach((msg, idx) => {
        const truncatedContent = msg.content.substring(0, 100);
        const displayContent = msg.content.length > 100 ? `${truncatedContent}...` : truncatedContent;
        info.push(`${msg.role}: ${displayContent}`);
      });
    }

    // セッション情報の追加
    if (context.sessionContext) {
      info.push(`**Session**: ${context.sessionContext.sessionId}`);
      info.push(`**Previous Interactions**: ${context.sessionContext.previousInteractions}`);
      
      if (context.sessionContext.duration > 0) {
        info.push(`**Session Duration**: ${Math.round(context.sessionContext.duration / 1000)}s`);
      }
    }

    if (info.length === 0) {
      return '';
    }

    const content = `## Context Information\n\n${info.join('\n')}`;
    return this.truncateIfNeeded(content);
  }

  isRequired(): boolean {
    return false; // コンテキスト情報がない場合は空文字列
  }
}
