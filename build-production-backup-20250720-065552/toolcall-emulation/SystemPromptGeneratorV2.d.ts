/**
 * Refactored System Prompt Generator
 * リファクタリング後のシステムプロンプト生成器
 * 責任分離：組み立て責任のみに集中、Strategy Pattern適用
 */
import { PromptSectionBuilder } from './prompt-builders/index.js';
import { PromptGeneratorConfig, GeneratedPrompt, PromptContext } from '../types/prompt.js';
/**
 * プロンプト組み立て責任に特化したSystemPromptGenerator
 */
export declare class SystemPromptGenerator {
    private config;
    private builders;
    constructor(config?: PromptGeneratorConfig, customBuilders?: PromptSectionBuilder[]);
    /**
     * メインの組み立てメソッド（責任を組み立てのみに限定）
     */
    generateSystemPrompt(userMessage: string, context: PromptContext): GeneratedPrompt;
    /**
     * アクティブなBuilderの選択（Strategy Pattern）
     */
    private selectActiveBuilders;
    /**
     * Builderの適用条件判定
     */
    private isBuilderApplicable;
    /**
     * セクション生成（各Builderに委譲）
     */
    private generateSections;
    /**
     * プロンプトの組み立て（組み立て責任のみ）
     */
    private assemblePrompt;
    /**
     * ベースプロンプト（固定セクション）
     */
    private buildBasePrompt;
    /**
     * ユーザープロンプトの拡張
     */
    private enhanceUserPrompt;
    /**
     * プロンプトの切り詰め
     */
    private truncatePrompt;
    /**
     * デフォルトBuilderの作成（DIの柔軟性）
     */
    private createDefaultBuilders;
    /**
     * Builder管理メソッド（拡張性）
     */
    addBuilder(builder: PromptSectionBuilder): void;
    removeBuilder(builderClass: any): void;
    replaceBuilder(builderClass: any, newBuilder: PromptSectionBuilder): void;
    /**
     * 統計情報の取得
     */
    getBuilderStatistics(): {
        totalBuilders: number;
        enabledBuilders: number;
        builderTypes: string[];
    };
}
