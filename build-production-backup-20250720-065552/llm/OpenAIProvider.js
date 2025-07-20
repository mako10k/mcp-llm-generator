/**
 * OpenAI API Provider
 * OpenAI GPT モデルとの統合
 */
import { BaseLLMProvider } from './LLMProvider.js';
export class OpenAIProvider extends BaseLLMProvider {
    name = 'OpenAI';
    supportedModels = [
        'gpt-4o',
        'gpt-4o-mini',
        'gpt-4-turbo',
        'gpt-4',
        'gpt-3.5-turbo',
        'gpt-3.5-turbo-16k'
    ];
    supportsToolCalling = true;
    supportsStreaming = true;
    apiKey;
    baseURL;
    defaultModel;
    organization;
    constructor(config = {}) {
        super();
        this.apiKey = this.validateApiKey(config.apiKey || process.env.OPENAI_API_KEY, 'OpenAI');
        this.baseURL = config.baseURL || 'https://api.openai.com/v1';
        this.defaultModel = config.defaultModel || 'gpt-4o-mini';
        this.organization = config.organization || process.env.OPENAI_ORG_ID;
    }
    async generateMessage(messages, options = {}) {
        try {
            const response = await this.makeRequest('/chat/completions', {
                model: options.model || this.defaultModel,
                messages: this.formatMessages(messages),
                max_tokens: options.maxTokens || 1000,
                temperature: options.temperature ?? 0.7,
                top_p: options.topP,
                stop: options.stop,
                stream: false,
                tools: options.tools,
                tool_choice: options.toolChoice,
                ...options.metadata
            });
            const choice = response.choices[0];
            return {
                content: choice.message.content || '',
                model: response.model,
                stopReason: choice.finish_reason,
                usage: response.usage ? {
                    inputTokens: response.usage.prompt_tokens,
                    outputTokens: response.usage.completion_tokens,
                    totalTokens: response.usage.total_tokens
                } : undefined,
                finishReason: choice.finish_reason,
                metadata: {
                    id: response.id,
                    created: response.created,
                    systemFingerprint: response.system_fingerprint
                }
            };
        }
        catch (error) {
            this.handleError(error, 'generateMessage');
        }
    }
    async generateWithTools(messages, tools, options = {}) {
        return this.generateMessage(messages, {
            ...options,
            tools: this.formatTools(tools),
            toolChoice: options.toolChoice || 'auto'
        });
    }
    async *generateMessageStream(messages, options = {}) {
        try {
            const response = await this.makeRequest('/chat/completions', {
                model: options.model || this.defaultModel,
                messages: this.formatMessages(messages),
                max_tokens: options.maxTokens || 1000,
                temperature: options.temperature ?? 0.7,
                top_p: options.topP,
                stop: options.stop,
                stream: true,
                tools: options.tools,
                tool_choice: options.toolChoice
            }, true);
            let buffer = '';
            const decoder = new TextDecoder();
            for await (const chunk of response.body) {
                buffer += decoder.decode(chunk, { stream: true });
                const lines = buffer.split('\\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') {
                            return;
                        }
                        try {
                            const parsed = JSON.parse(data);
                            const choice = parsed.choices[0];
                            if (choice?.delta?.content) {
                                yield {
                                    content: choice.delta.content,
                                    model: parsed.model,
                                    stopReason: choice.finish_reason,
                                    metadata: { id: parsed.id, streaming: true }
                                };
                            }
                        }
                        catch (parseError) {
                            // Skip invalid JSON lines
                        }
                    }
                }
            }
        }
        catch (error) {
            this.handleError(error, 'generateMessageStream');
        }
    }
    async getAvailableModels() {
        try {
            const response = await this.makeRequest('/models');
            return response.data
                .filter((model) => model.id.startsWith('gpt-'))
                .map((model) => model.id)
                .sort();
        }
        catch (error) {
            console.warn('Failed to fetch OpenAI models, using default list:', error);
            return this.supportedModels;
        }
    }
    formatMessages(messages) {
        return messages.map(msg => ({
            role: msg.role,
            content: msg.content
        }));
    }
    formatTools(tools) {
        return tools.map(tool => ({
            type: 'function',
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.inputSchema || tool.parameters
            }
        }));
    }
    async makeRequest(endpoint, body, stream = false) {
        const headers = {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
        };
        if (this.organization) {
            headers['OpenAI-Organization'] = this.organization;
        }
        const response = await fetch(`${this.baseURL}${endpoint}`, {
            method: body ? 'POST' : 'GET',
            headers,
            body: body ? JSON.stringify(body) : undefined
        });
        if (!response.ok) {
            const errorBody = await response.text();
            const error = new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
            error.response = {
                status: response.status,
                statusText: response.statusText,
                body: errorBody
            };
            throw error;
        }
        if (stream) {
            return response;
        }
        return response.json();
    }
}
