/**
 * OpenAI API Provider
 * OpenAI GPT モデルとの統合
 */
import { BaseLLMProvider, LLMResponse, Message, LLMRequestOptions } from './LLMProvider.js';
export interface OpenAIConfig {
    apiKey?: string;
    baseURL?: string;
    defaultModel?: string;
    organization?: string;
}
export declare class OpenAIProvider extends BaseLLMProvider {
    readonly name = "OpenAI";
    readonly supportedModels: string[];
    readonly supportsToolCalling = true;
    readonly supportsStreaming = true;
    private apiKey;
    private baseURL;
    private defaultModel;
    private organization?;
    constructor(config?: OpenAIConfig);
    generateMessage(messages: Message[], options?: LLMRequestOptions): Promise<LLMResponse>;
    generateWithTools(messages: Message[], tools: any[], options?: LLMRequestOptions): Promise<LLMResponse>;
    generateMessageStream(messages: Message[], options?: LLMRequestOptions): AsyncIterable<LLMResponse>;
    getAvailableModels(): Promise<string[]>;
    private formatMessages;
    private formatTools;
    private makeRequest;
}
