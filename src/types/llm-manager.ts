/**
 * LLM Manager interface definition
 * 
 * Provides type-safe interface for LLM generation functionality
 * used by SystemPromptMergeEngine and other components.
 */

/**
 * LLM Generation configuration
 */
export interface LLMGenerationConfig {
  maxTokens?: number;
  temperature?: number;
  stopSequences?: string[];
}

/**
 * LLM Generation response
 */
export interface LLMGenerationResponse {
  text: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * LLM Manager interface for dependency injection
 */
export interface LLMManager {
  generateText(
    prompt: string, 
    config?: LLMGenerationConfig
  ): Promise<LLMGenerationResponse>;
  
  generateJSON<T>(
    prompt: string, 
    schema: unknown,
    config?: LLMGenerationConfig
  ): Promise<T>;
  
  generateMessage(
    messages: Array<{ role: string; content: string }>,
    config?: LLMGenerationConfig
  ): Promise<LLMGenerationResponse>;
}
