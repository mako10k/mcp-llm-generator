import { PromptInjectionAttempt, SecurityValidationResult, PromptSecurityLevel } from '../types/persona.js';
export declare class PromptSecurityManager {
    private readonly INJECTION_PATTERNS;
    private readonly SUSPICIOUS_KEYWORDS;
    private readonly ENCODING_PATTERNS;
    /**
     * プロンプトのセキュリティ検証
     */
    validatePrompt(prompt: string, securityLevel?: PromptSecurityLevel): SecurityValidationResult;
    /**
     * プロンプトのサニタイゼーション
     */
    sanitizePrompt(prompt: string, securityLevel?: PromptSecurityLevel): {
        sanitized_prompt: string;
        removed_content: string[];
        applied_filters: string[];
    };
    /**
     * 構造的リスク分析
     */
    private analyzeStructuralRisk;
    /**
     * セキュリティレベル別の閾値取得
     */
    private getSecurityThreshold;
    /**
     * 推奨事項の生成
     */
    private generateRecommendations;
    /**
     * セキュリティ設定の動的調整
     */
    adjustSecurityLevel(currentLevel: PromptSecurityLevel, recentAttempts: PromptInjectionAttempt[]): PromptSecurityLevel;
}
export declare const promptSecurityManager: PromptSecurityManager;
