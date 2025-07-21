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
export declare abstract class BasePromptSectionBuilder implements PromptSectionBuilder {
    protected config: BuilderConfig;
    constructor(config?: BuilderConfig);
    abstract build(context: PromptContext): string;
    abstract getSectionName(): string;
    getPriority(): number;
    isRequired(): boolean;
    /**
     * 長さ制限の適用
     */
    protected truncateIfNeeded(content: string): string;
}
