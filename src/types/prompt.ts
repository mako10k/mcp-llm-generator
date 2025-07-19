/**
 * Prompt Types
 * プロンプト生成関連の型定義
 */

import { Tool } from './tool.js';
import { PersonaCapabilities } from './persona.js';

export interface PromptGeneratorConfig {
  includeExamples: boolean;
  strictMode: boolean;
  personaAware: boolean;
  contextLengthLimit: number;
  includeToolValidation: boolean;
}

export interface GeneratedPrompt {
  systemPrompt: string;
  userPrompt: string;
  metadata: {
    toolCount: number;
    promptLength: number;
    schemaComplexity: number;
    personaIncluded: boolean;
    generatedAt: Date;
  };
}

export interface PromptContext {
  availableTools: Tool[];
  persona?: PersonaCapabilities;
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  constraints?: {
    maxTokens?: number;
    allowedActions?: string[];
    forbiddenActions?: string[];
  };
  sessionContext?: {
    sessionId: string;
    duration: number;
    previousInteractions: number;
  };
}

export interface SystemPromptTemplate {
  basePrompt: string;
  toolDescriptions: string;
  outputSchema: string;
  examples: string;
}

export interface PromptSection {
  name: string;
  content: string;
  priority: number;
  required: boolean;
}
