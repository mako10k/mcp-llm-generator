/**
 * Prompt Section Builder Interface
 * Strategy Pattern for generating different sections of the system prompt
 */

import { PromptContext } from '../../types/prompt.js';

export interface PromptSectionBuilder {
  /**
   * プロンプトセクションを生成
   */
  build(context: PromptContext): string;

  /**
   * このビルダーが生成するセクションの重要度（0-10）
   */
  getPriority(): number;

  /**
   * このビルダーのセクション名
   */
  getSectionName(): string;

  /**
   * このセクションが必須かどうか
   */
  isRequired(): boolean;
}

export interface BuilderConfig {
  enabled: boolean;
  priority: number;
  maxLength?: number;
}

export abstract class BasePromptSectionBuilder implements PromptSectionBuilder {
  protected config: BuilderConfig;

  constructor(config: BuilderConfig = { enabled: true, priority: 5 }) {
    this.config = config;
  }

  abstract build(context: PromptContext): string;
  abstract getSectionName(): string;

  getPriority(): number {
    return this.config.priority;
  }

  isRequired(): boolean {
    return this.config.enabled;
  }

  /**
   * 長さ制限の適用
   */
  protected truncateIfNeeded(content: string): string {
    if (this.config.maxLength && content.length > this.config.maxLength) {
      return content.substring(0, this.config.maxLength) + '\n... (truncated)';
    }
    return content;
  }
}
