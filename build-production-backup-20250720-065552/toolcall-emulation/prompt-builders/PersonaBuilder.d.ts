/**
 * Persona Builder
 * 人格コンテキスト生成のStrategy実装
 */
import { BasePromptSectionBuilder, BuilderConfig } from './PromptSectionBuilder.js';
import { PromptContext } from '../../types/prompt.js';
export declare class PersonaBuilder extends BasePromptSectionBuilder {
    constructor(config?: BuilderConfig);
    getSectionName(): string;
    build(context: PromptContext): string;
    isRequired(): boolean;
}
