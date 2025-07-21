/**
 * LLM Provider Interface
 * 外部LLM APIの抽象化インターフェース
 */
export class BaseLLMProvider {
    async healthCheck() {
        try {
            const response = await this.generateMessage([
                { role: 'user', content: 'Hello' }
            ], { maxTokens: 10 });
            return !!response.content;
        }
        catch (error) {
            console.error(`Health check failed for ${this.name}:`, error);
            return false;
        }
    }
    /**
     * 共通のエラーハンドリング
     */
    handleError(error, operation) {
        console.error(`${this.name} ${operation} error:`, error);
        if (error.response?.status === 401) {
            throw new Error(`${this.name}: Invalid API key`);
        }
        else if (error.response?.status === 429) {
            throw new Error(`${this.name}: Rate limit exceeded`);
        }
        else if (error.response?.status === 404) {
            throw new Error(`${this.name}: Model not found`);
        }
        else {
            throw new Error(`${this.name}: ${error.message || 'Unknown error'}`);
        }
    }
    /**
     * APIキーの検証
     */
    validateApiKey(apiKey, providerName) {
        if (!apiKey) {
            throw new Error(`${providerName}: API key is required. Set environment variable.`);
        }
        return apiKey;
    }
}
