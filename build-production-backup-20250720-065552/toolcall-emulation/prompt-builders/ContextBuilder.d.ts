/**
 * Context Builder
 * コンテキスト情報生成のStrategy実装
 */
import { BasePromptSectionBuilder, BuilderConfig } from './PromptSectionBuilder.js';
import { PromptContext } from '../../types/prompt.js';
export declare class ContextBuilder extends BasePromptSectionBuilder {
    constructor(config?: BuilderConfig);
    getSectionName(): string;
    build(context: PromptContext): string;
    isRequired(): boolean;
}
