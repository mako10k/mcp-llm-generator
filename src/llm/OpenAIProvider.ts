/**
 * OpenAI API Provider
 * OpenAI GPT モデルとの統合
 */

import { BaseLLMProvider, LLMResponse, Message, LLMRequestOptions } from './LLMProvider.js';

// OpenAI API レスポンス型の定義
interface OpenAIChoice {
  message: {
    content: string | null;
  };
  finish_reason: string;
  delta?: {
    content?: string;
  };
}

interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface OpenAIChatResponse {
  id: string;
  created: number;
  model: string;
  choices: OpenAIChoice[];
  usage?: OpenAIUsage;
  system_fingerprint?: string;
}

interface OpenAIModel {
  id: string;
}

interface OpenAIModelsResponse {
  data: OpenAIModel[];
}

// エラー型の定義
interface OpenAIError extends Error {
  response?: {
    status: number;
    statusText: string;
    body: string;
  };
}

// 型ガード関数
function isOpenAIChatResponse(obj: unknown): obj is OpenAIChatResponse {
  if (typeof obj !== 'object' || obj === null) return false;
  const candidate = obj as Record<string, unknown>;
  return 'choices' in candidate && 
         'model' in candidate &&
         Array.isArray(candidate.choices);
}

function isOpenAIModelsResponse(obj: unknown): obj is OpenAIModelsResponse {
  if (typeof obj !== 'object' || obj === null) return false;
  const candidate = obj as Record<string, unknown>;
  return 'data' in candidate && Array.isArray(candidate.data);
}

function isStreamResponse(obj: unknown): obj is Response {
  return obj instanceof Response;
}

// Tool型の安全な型ガード
function isValidTool(obj: unknown): obj is { name: string; description: string; inputSchema?: unknown; parameters?: unknown } {
  if (typeof obj !== 'object' || obj === null) return false;
  const candidate = obj as Record<string, unknown>;
  return typeof candidate.name === 'string' &&
         typeof candidate.description === 'string';
}

export interface OpenAIConfig {
  apiKey?: string;
  baseURL?: string;
  defaultModel?: string;
  organization?: string;
}

export class OpenAIProvider extends BaseLLMProvider {
  readonly name = 'OpenAI';
  readonly supportedModels = [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-4',
    'gpt-3.5-turbo',
    'gpt-3.5-turbo-16k'
  ];
  readonly supportsToolCalling = true;
  readonly supportsStreaming = true;

  private apiKey: string;
  private baseURL: string;
  private defaultModel: string;
  private organization?: string;

  constructor(config: OpenAIConfig = {}) {
    super();
    this.apiKey = this.validateApiKey(
      config.apiKey || process.env.OPENAI_API_KEY,
      'OpenAI'
    );
    this.baseURL = config.baseURL || 'https://api.openai.com/v1';
    this.defaultModel = config.defaultModel || 'gpt-4o-mini';
    this.organization = config.organization || process.env.OPENAI_ORG_ID;
  }

  async generateMessage(
    messages: Message[],
    options: LLMRequestOptions = {}
  ): Promise<LLMResponse> {
    try {
      const responseData = await this.makeRequest('/chat/completions', {
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

      if (!isOpenAIChatResponse(responseData)) {
        throw new Error(`Invalid response format from OpenAI chat API. Expected object with 'choices' and 'model', received: ${JSON.stringify(responseData)}`);
      }

      if (!responseData.choices || responseData.choices.length === 0) {
        throw new Error('OpenAI API returned empty choices array');
      }

      const choice = responseData.choices[0];
      if (!choice.message) {
        throw new Error(`Invalid choice format: missing 'message' property. Received: ${JSON.stringify(choice)}`);
      }
      return {
        content: choice.message.content || '',
        model: responseData.model,
        stopReason: choice.finish_reason,
        usage: responseData.usage ? {
          inputTokens: responseData.usage.prompt_tokens,
          outputTokens: responseData.usage.completion_tokens,
          totalTokens: responseData.usage.total_tokens
        } : undefined,
        finishReason: choice.finish_reason,
        metadata: {
          id: responseData.id,
          created: responseData.created,
          systemFingerprint: responseData.system_fingerprint
        }
      };
    } catch (error) {
      this.handleError(error, 'generateMessage');
    }
  }

  async generateWithTools(
    messages: Message[],
    tools: unknown[],
    options: LLMRequestOptions = {}
  ): Promise<LLMResponse> {
    return this.generateMessage(messages, {
      ...options,
      tools: this.formatTools(tools),
      toolChoice: options.toolChoice || 'auto'
    });
  }

  async *generateMessageStream(
    messages: Message[],
    options: LLMRequestOptions = {}
  ): AsyncIterable<LLMResponse> {
    try {
      const responseData = await this.makeRequest('/chat/completions', {
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

      if (!isStreamResponse(responseData)) {
        throw new Error('Expected stream response from OpenAI API');
      }

      if (!responseData.body) {
        throw new Error('No response body available for streaming');
      }

      let buffer = '';
      const decoder = new TextDecoder();

      for await (const chunk of responseData.body) {
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
            } catch (parseError) {
              // Skip invalid JSON lines
            }
          }
        }
      }
    } catch (error) {
      this.handleError(error, 'generateMessageStream');
    }
  }

  async getAvailableModels(): Promise<string[]> {
    try {
      const responseData = await this.makeRequest('/models');
      
      if (!isOpenAIModelsResponse(responseData)) {
        throw new Error(`Invalid response format from OpenAI models API. Expected object with 'data' array, received: ${JSON.stringify(responseData)}`);
      }

      const models = responseData.data
        .filter((model: OpenAIModel) => {
          if (typeof model.id !== 'string') {
            throw new Error(`Invalid model object: missing or invalid 'id' property. Received: ${JSON.stringify(model)}`);
          }
          return model.id.startsWith('gpt-');
        })
        .map((model: OpenAIModel) => model.id)
        .sort();

      if (models.length === 0) {
        throw new Error('No valid GPT models found in OpenAI API response');
      }

      return models;
    } catch (error) {
      // ここでもサイレントフォールバックではなく、エラーを再スロー
      console.error('Failed to fetch OpenAI models:', error);
      throw new Error(`OpenAI models API failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private formatMessages(messages: Message[]): Array<Record<string, unknown>> {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
  }

  private formatTools(tools: unknown[]): Array<Record<string, unknown>> {
    return tools.map((toolItem, index) => {
      if (!isValidTool(toolItem)) {
        throw new Error(`Invalid tool at index ${index}: missing required properties 'name' or 'description'. Received: ${JSON.stringify(toolItem)}`);
      }
      
      return {
        type: 'function',
        function: {
          name: toolItem.name,
          description: toolItem.description,
          parameters: toolItem.inputSchema || toolItem.parameters
        }
      };
    });
  }

  private async makeRequest(
    endpoint: string,
    body?: Record<string, unknown>,
    stream = false
  ): Promise<OpenAIChatResponse | OpenAIModelsResponse | Response> {
    const headers: Record<string, string> = {
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
      const error = new Error(`OpenAI API error: ${response.status} ${response.statusText}`) as OpenAIError;
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

    return response.json() as Promise<OpenAIChatResponse | OpenAIModelsResponse>;
  }
}
