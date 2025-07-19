/**
 * Example Builder
 * プロンプト例生成のStrategy実装
 */
import { BasePromptSectionBuilder, BuilderConfig } from './PromptSectionBuilder.js';
import { PromptContext } from '../../types/prompt.js';
export declare class ExampleBuilder extends BasePromptSectionBuilder {
    constructor(config?: BuilderConfig);
    getSectionName(): string;
    build(context: PromptContext): string;
}
