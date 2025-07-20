import { PersonaCapabilities, CompressedCapabilities, PromptOptimizationOptions } from '../types/persona.js';
export declare class PromptTokenManager {
    private encodings;
    constructor();
    private initializeEncodings;
    /**
     * テキストのトークン数を計算
     */
    calculateTokens(text: string, model?: string): number;
    /**
     * 能力情報を圧縮
     */
    compressCapabilities(capabilities: PersonaCapabilities, level?: 'light' | 'medium' | 'heavy'): CompressedCapabilities;
    /**
     * ツール一覧を要約
     */
    private summarizeTools;
    /**
     * タスクに関連する能力のみを選択
     */
    selectRelevantCapabilities(task: string, allCapabilities: PersonaCapabilities): CompressedCapabilities;
    /**
     * キーワード抽出（簡易版）
     */
    private extractKeywords;
    /**
     * プロンプトの最適化
     */
    optimizePrompt(basePrompt: string, capabilities: CompressedCapabilities, options: PromptOptimizationOptions): string;
    /**
     * 能力情報のフォーマット
     */
    private formatCapabilities;
    /**
     * 能力情報の段階的削減
     */
    private reduceCapabilityInfo;
    /**
     * プロンプトのトークン使用統計
     */
    analyzePromptTokens(prompt: string, model?: string): {
        total_tokens: number;
        estimated_cost: number;
        model: string;
        analysis: {
            base_prompt_tokens: number;
            capability_tokens: number;
            efficiency_score: number;
        };
    };
    /**
     * モデル別コスト取得（概算）
     */
    private getModelCostPer1000Tokens;
    /**
     * リソースクリーンアップ
     */
    dispose(): void;
}
export declare const promptTokenManager: PromptTokenManager;
