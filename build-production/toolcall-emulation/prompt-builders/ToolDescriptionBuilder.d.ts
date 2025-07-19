/**
 * Tool Description Builder
 * ツール記述生成のStrategy実装
 */
import { BasePromptSectionBuilder, BuilderConfig } from './PromptSectionBuilder.js';
import { PromptContext } from '../../types/prompt.js';
export declare class ToolDescriptionBuilder extends BasePromptSectionBuilder {
    constructor(config?: BuilderConfig);
    getSectionName(): string;
    build(context: PromptContext): string;
    /**
     * 単一ツールのフォーマット
     */
    private formatSingleTool;
    /**
     * 使用ヒントの生成
     */
    private generateUsageHint;
}
