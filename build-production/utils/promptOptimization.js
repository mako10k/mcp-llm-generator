// Sprint4 Phase 1: プロンプト最適化・トークン数管理モジュール
import { encoding_for_model, get_encoding } from 'tiktoken';
/**
 * 型安全なPersonaCapabilitiesユーティリティ関数
 */
function safeGetStringArray(array) {
    return Array.isArray(array) ? array : [];
}
export class PromptTokenManager {
    encodings = new Map();
    constructor() {
        // 主要モデルのエンコーディングを事前にロード
        this.initializeEncodings();
    }
    async initializeEncodings() {
        try {
            // GPTシリーズ
            this.encodings.set('gpt-4', encoding_for_model('gpt-4'));
            this.encodings.set('gpt-3.5-turbo', encoding_for_model('gpt-3.5-turbo'));
            // Claude用（GPT-4エンコーディングを近似値として使用）
            this.encodings.set('claude-3-sonnet', encoding_for_model('gpt-4'));
            this.encodings.set('claude-3-haiku', encoding_for_model('gpt-4'));
            console.log('✅ Token encodings initialized');
        }
        catch (error) {
            console.error('❌ Failed to initialize token encodings:', error);
            // フォールバック: cl100k_baseエンコーディング使用
            this.encodings.set('fallback', get_encoding('cl100k_base'));
        }
    }
    /**
     * テキストのトークン数を計算
     */
    calculateTokens(text, model = 'gpt-4') {
        try {
            const encoding = this.encodings.get(model) || this.encodings.get('fallback');
            if (!encoding) {
                // 最終フォールバック: 文字数/4で近似
                return Math.ceil(text.length / 4);
            }
            return encoding.encode(text).length;
        }
        catch (error) {
            console.error(`❌ Token calculation failed for model ${model}:`, error);
            return Math.ceil(text.length / 4);
        }
    }
    /**
     * 能力情報を圧縮
     */
    compressCapabilities(capabilities, level = 'medium') {
        switch (level) {
            case 'light':
                return {
                    expertise_tags: safeGetStringArray(capabilities.expertise).slice(0, 8),
                    tool_summary: this.summarizeTools(safeGetStringArray(capabilities.tools), 30),
                    key_restrictions: safeGetStringArray(capabilities.restrictions).slice(0, 5)
                };
            case 'medium':
                return {
                    expertise_tags: safeGetStringArray(capabilities.expertise).slice(0, 5),
                    tool_summary: this.summarizeTools(safeGetStringArray(capabilities.tools), 20),
                    key_restrictions: safeGetStringArray(capabilities.restrictions).slice(0, 3)
                };
            case 'heavy':
                return {
                    expertise_tags: safeGetStringArray(capabilities.expertise).slice(0, 3),
                    tool_summary: this.summarizeTools(safeGetStringArray(capabilities.tools), 15),
                    key_restrictions: safeGetStringArray(capabilities.restrictions).slice(0, 2)
                };
        }
    }
    /**
     * ツール一覧を要約
     */
    summarizeTools(tools, maxLength) {
        if (tools.length === 0)
            return '一般的な作業';
        const summary = tools.join('・');
        if (summary.length <= maxLength) {
            return summary;
        }
        // 長い場合は省略
        const truncated = summary.substring(0, maxLength - 3);
        return truncated + '...';
    }
    /**
     * タスクに関連する能力のみを選択
     */
    selectRelevantCapabilities(task, allCapabilities) {
        const taskKeywords = this.extractKeywords(task.toLowerCase());
        // タスクに関連するツールを抽出
        const allTools = safeGetStringArray(allCapabilities.tools);
        const allExpertise = safeGetStringArray(allCapabilities.expertise);
        const relevantTools = allTools.filter(tool => taskKeywords.some(keyword => tool.toLowerCase().includes(keyword)));
        // タスクに関連する専門分野を抽出
        const relevantExpertise = allExpertise.filter(exp => taskKeywords.some(keyword => exp.toLowerCase().includes(keyword)));
        return this.compressCapabilities({
            ...allCapabilities,
            tools: relevantTools.length > 0 ? relevantTools : allTools.slice(0, 3),
            expertise: relevantExpertise.length > 0 ? relevantExpertise : allExpertise.slice(0, 3)
        });
    }
    /**
     * キーワード抽出（簡易版）
     */
    extractKeywords(text) {
        // 基本的なキーワード抽出
        const keywords = text
            .split(/[\s\u3000]+/) // 半角・全角スペースで分割
            .filter(word => word.length > 1)
            .map(word => word.replace(/[^\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '')) // 特殊文字除去
            .filter(word => word.length > 1);
        return [...new Set(keywords)]; // 重複除去
    }
    /**
     * プロンプトの最適化
     */
    optimizePrompt(basePrompt, capabilities, options) {
        const capabilityText = this.formatCapabilities(capabilities, options);
        const fullPrompt = basePrompt + '\n\n' + capabilityText;
        const tokenCount = this.calculateTokens(fullPrompt, options.model);
        if (tokenCount <= options.max_tokens) {
            return fullPrompt;
        }
        // トークン数超過の場合、段階的に削減
        return this.reduceCapabilityInfo(basePrompt, capabilities, options);
    }
    /**
     * 能力情報のフォーマット
     */
    formatCapabilities(capabilities, options) {
        const parts = [];
        if (!options.include_expertise_only && capabilities.tool_summary) {
            parts.push(`利用可能ツール: ${capabilities.tool_summary}`);
        }
        if (!options.include_tools_only && capabilities.expertise_tags.length > 0) {
            parts.push(`専門分野: ${capabilities.expertise_tags.join('、')}`);
        }
        if (capabilities.key_restrictions.length > 0) {
            parts.push(`制限事項: ${capabilities.key_restrictions.join('、')}`);
        }
        return parts.length > 0 ? `【能力情報】\n${parts.join('\n')}` : '';
    }
    /**
     * 能力情報の段階的削減
     */
    reduceCapabilityInfo(basePrompt, capabilities, options) {
        // Step 1: 制限事項を削除
        let reducedCapabilities = {
            ...capabilities,
            key_restrictions: []
        };
        let prompt = basePrompt + '\n\n' + this.formatCapabilities(reducedCapabilities, options);
        if (this.calculateTokens(prompt, options.model) <= options.max_tokens) {
            return prompt;
        }
        // Step 2: 専門分野を半分に
        reducedCapabilities.expertise_tags = capabilities.expertise_tags.slice(0, Math.ceil(capabilities.expertise_tags.length / 2));
        prompt = basePrompt + '\n\n' + this.formatCapabilities(reducedCapabilities, options);
        if (this.calculateTokens(prompt, options.model) <= options.max_tokens) {
            return prompt;
        }
        // Step 3: ツール情報のみ
        reducedCapabilities = {
            expertise_tags: [],
            tool_summary: capabilities.tool_summary,
            key_restrictions: []
        };
        prompt = basePrompt + '\n\n' + this.formatCapabilities(reducedCapabilities, options);
        if (this.calculateTokens(prompt, options.model) <= options.max_tokens) {
            return prompt;
        }
        // Step 4: 能力情報なし
        return basePrompt;
    }
    /**
     * プロンプトのトークン使用統計
     */
    analyzePromptTokens(prompt, model = 'gpt-4') {
        const totalTokens = this.calculateTokens(prompt, model);
        // コスト計算（概算）
        const costPer1000Tokens = this.getModelCostPer1000Tokens(model);
        const estimatedCost = (totalTokens / 1000) * costPer1000Tokens;
        // 効率性スコア（簡易版）
        const efficiencyScore = Math.max(0, 100 - (totalTokens / 40)); // 4000トークンで0点
        return {
            total_tokens: totalTokens,
            estimated_cost: estimatedCost,
            model,
            analysis: {
                base_prompt_tokens: totalTokens,
                capability_tokens: 0, // TODO: 詳細分析実装
                efficiency_score: Math.round(efficiencyScore)
            }
        };
    }
    /**
     * モデル別コスト取得（概算）
     */
    getModelCostPer1000Tokens(model) {
        const costs = {
            'gpt-4': 0.03,
            'gpt-3.5-turbo': 0.002,
            'claude-3-sonnet': 0.015,
            'claude-3-haiku': 0.0025
        };
        return costs[model] || 0.01; // デフォルト値
    }
    /**
     * リソースクリーンアップ
     */
    dispose() {
        for (const encoding of this.encodings.values()) {
            try {
                encoding.free();
            }
            catch (error) {
                // エラーは無視（一部のエンコーディングはfreeメソッドがない）
            }
        }
        this.encodings.clear();
    }
}
// シングルトンインスタンス
export const promptTokenManager = new PromptTokenManager();
