/**
 * Constraint Builder
 * 制約事項生成のStrategy実装
 */
import { BasePromptSectionBuilder, BuilderConfig } from './PromptSectionBuilder.js';
import { PromptContext } from '../../types/prompt.js';
export declare class ConstraintBuilder extends BasePromptSectionBuilder {
    private strictMode;
    private includeToolValidation;
    constructor(strictMode?: boolean, includeToolValidation?: boolean, config?: BuilderConfig);
    getSectionName(): string;
    build(context: PromptContext): string;
    isRequired(): boolean;
}
