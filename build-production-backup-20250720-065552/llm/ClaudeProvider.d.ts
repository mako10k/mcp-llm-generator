/**
 * Anthropic Claude API Provider
 * Claude モデルとの統合
 */
import { BaseLLMProvider, LLMResponse, Message, LLMRequestOptions } from './LLMProvider.js';
export interface ClaudeConfig {
    apiKey?: string;
    baseURL?: string;
    defaultModel?: string;
    version?: string;
}
export declare class ClaudeProvider extends BaseLLMProvider {
    readonly name = "Claude";
    readonly supportedModels: string[];
    readonly supportsToolCalling = true;
    readonly supportsStreaming = true;
    private apiKey;
    private baseURL;
    private defaultModel;
    private version;
    constructor(config?: ClaudeConfig);
    generateMessage(messages: Message[], options?: LLMRequestOptions): Promise<LLMResponse>;
    generateWithTools(messages: Message[], tools: any[], options?: LLMRequestOptions): Promise<LLMResponse>;
    generateMessageStream(messages: Message[], options?: LLMRequestOptions): AsyncIterable<LLMResponse>;
    private formatMessages;
    private formatTools;
    private makeRequest;
}
