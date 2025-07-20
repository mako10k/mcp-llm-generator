/**
 * System Prompt Generator
 * 動的スキーマ定義とコンテキスト対応のシステムプロンプト生成器
 */
import { PromptGeneratorConfig, GeneratedPrompt, PromptContext, SystemPromptTemplate } from '../types/prompt.js';
export declare class SystemPromptGenerator {
    private config;
    private templateCache;
    private useParameterFormatter;
    private usePersonaBuilder;
    constructor(config?: PromptGeneratorConfig);
    /**
     * メインのプロンプト生成メソッド
     */
    generateSystemPrompt(userMessage: string, context: PromptContext): GeneratedPrompt;
    /**
     * ベースプロンプトの構築
     */
    private buildBasePrompt;
    /**
     * ツール記述の生成
     */
    private generateToolDescriptions;
    /**
     * パラメータのフォーマット - Feature Flag による段階的統合
     */
    private formatParameters;
    /**
     * 使用ヒントの生成
     */
    private generateUsageHint;
    /**
     * 出力スキーマの生成
     */
    private generateOutputSchema;
    /**
     * 例の生成
     */
    private generateExamples;
    /**
     * 人格セクションの生成
     * Feature Flag により新しいPersonaBuilderと既存ロジックを切り替え
     */
    private generatePersonaSection;
    /**
     * 制約事項の生成
     */
    private generateConstraints;
    /**
     * コンテキスト情報の生成
     */
    private generateContextInfo;
    /**
     * システムプロンプトの組み立て
     */
    private assembleSystemPrompt;
    /**
     * ユーザープロンプトの拡張
     */
    private enhanceUserPrompt;
    /**
     * スキーマ複雑度の計算
     */
    private calculateSchemaComplexity;
    /**
     * プロンプトの切り詰め
     */
    private truncatePrompt;
    /**
     * テンプレートの初期化
     */
    private initializeTemplates;
    /**
     * カスタムテンプレートの追加
     */
    addTemplate(name: string, template: SystemPromptTemplate): void;
    /**
     * 統計情報の取得
     */
    getGenerationStatistics(): {
        templatesCount: number;
        averagePromptLength: number;
        cacheHitRate: number;
    };
}
