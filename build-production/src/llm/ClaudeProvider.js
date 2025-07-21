/**
 * Anthropic Claude API Provider
 * Claude モデルとの統合
 */
import { BaseLLMProvider } from './LLMProvider.js';
export class ClaudeProvider extends BaseLLMProvider {
    name = 'Claude';
    supportedModels = [
        'claude-3-5-sonnet-20241022',
        'claude-3-5-haiku-20241022',
        'claude-3-opus-20240229',
        'claude-3-sonnet-20240229',
        'claude-3-haiku-20240307'
    ];
    supportsToolCalling = true;
    supportsStreaming = true;
    apiKey;
    baseURL;
    defaultModel;
    version;
    constructor(config = {}) {
        super();
        this.apiKey = this.validateApiKey(config.apiKey || process.env.ANTHROPIC_API_KEY, 'Claude');
        this.baseURL = config.baseURL || 'https://api.anthropic.com';
        this.defaultModel = config.defaultModel || 'claude-3-5-sonnet-20241022';
        this.version = config.version || '2023-06-01';
    }
    async generateMessage(messages, options = {}) {
        try {
            const { system, messages: formattedMessages } = this.formatMessages(messages);
            const response = await this.makeRequest('/v1/messages', {
                model: options.model || this.defaultModel,
                max_tokens: options.maxTokens || 1000,
                temperature: options.temperature ?? 0.7,
                top_p: options.topP,
                stop_sequences: options.stop,
                system,
                messages: formattedMessages,
                tools: options.tools ? this.formatTools(options.tools) : undefined,
                tool_choice: options.toolChoice,
                stream: false,
                ...options.metadata
            });
            const content = response.content[0];
            return {
                content: content.type === 'text' ? content.text : '',
                model: response.model,
                stopReason: response.stop_reason,
                usage: response.usage ? {
                    inputTokens: response.usage.input_tokens,
                    outputTokens: response.usage.output_tokens,
                    totalTokens: response.usage.input_tokens + response.usage.output_tokens
                } : undefined,
                finishReason: response.stop_reason,
                metadata: {
                    id: response.id,
                    type: response.type,
                    role: response.role
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
            tools: tools,
            toolChoice: options.toolChoice || { type: 'auto' }
        });
    }
    async *generateMessageStream(messages, options = {}) {
        try {
            const { system, messages: formattedMessages } = this.formatMessages(messages);
            const response = await this.makeRequest('/v1/messages', {
                model: options.model || this.defaultModel,
                max_tokens: options.maxTokens || 1000,
                temperature: options.temperature ?? 0.7,
                top_p: options.topP,
                stop_sequences: options.stop,
                system,
                messages: formattedMessages,
                tools: options.tools ? this.formatTools(options.tools) : undefined,
                tool_choice: options.toolChoice,
                stream: true
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
                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                                yield {
                                    content: parsed.delta.text,
                                    model: options.model || this.defaultModel,
                                    metadata: { streaming: true, index: parsed.index }
                                };
                            }
                            else if (parsed.type === 'message_stop') {
                                return;
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
    formatMessages(messages) {
        const systemMessage = messages.find(msg => msg.role === 'system');
        const otherMessages = messages.filter(msg => msg.role !== 'system');
        return {
            system: systemMessage?.content,
            messages: otherMessages.map(msg => ({
                role: msg.role === 'assistant' ? 'assistant' : 'user',
                content: msg.content
            }))
        };
    }
    formatTools(tools) {
        return tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            input_schema: tool.inputSchema || tool.parameters || {
                type: 'object',
                properties: {},
                required: []
            }
        }));
    }
    async makeRequest(endpoint, body, stream = false) {
        const headers = {
            'x-api-key': this.apiKey,
            'anthropic-version': this.version,
            'Content-Type': 'application/json'
        };
        const response = await fetch(`${this.baseURL}${endpoint}`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });
        if (!response.ok) {
            const errorBody = await response.text();
            const error = new Error(`Claude API error: ${response.status} ${response.statusText}`);
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
