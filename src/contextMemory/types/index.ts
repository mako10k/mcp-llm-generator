/**
 * Context Memory System Type Definitions
 * 
 * Provides TypeScript types for the Context Memory System implementation.
 * These types are based on the specifications in context-memory-design.md
 */

// =============================================================================
// Core Data Models
// =============================================================================

export interface Context {
  id: string;                    // Unique context identifier
  name: string;                  // Human-readable context name
  systemPrompt: string;          // System prompt for LLM
  personality: string;           // Personality description in English
  temperature: number;           // Diversity parameter (0.0-1.0)
  maxTokens: number;            // Maximum response tokens
  maxHistoryTokens: number;     // Maximum conversation history tokens (default: 15000 for 16K context)
  expiryDays: number;           // Expiry duration in days
  createdAt: string;            // ISO timestamp
  updatedAt: string;            // ISO timestamp
  expiresAt: string;            // Calculated expiry timestamp
  isActive: boolean;            // Active status
}

export interface Conversation {
  id: string;           // Unique conversation identifier
  contextId: string;    // Foreign key to context
  role: 'user' | 'assistant' | 'system'; // Message role
  content: string;      // Message content
  tokenCount: number;   // Estimated token count
  createdAt: string;    // ISO timestamp
}

export interface PersonalityPreset {
  id: string;                    // Unique preset identifier
  name: string;                  // Human-readable preset name
  description: string;           // Preset description
  systemPrompt: string;          // Core personality system prompt
  defaultPersonality: string;    // Default personality description
  defaultSettings: {             // Default parameter values
    temperature: number;         // Default: 0.7
    maxTokens: number;          // Default: 1000
    maxHistoryTokens: number;   // Default: 15000 (16K context - 1K overhead)
    expiryDays: number;         // Default: 7
  };
  createdAt: string;            // ISO timestamp
  updatedAt: string;            // ISO timestamp
  isActive: boolean;            // Active status
  metadata?: Record<string, any>; // Additional metadata
}

// =============================================================================
// Default Personality Presets
// =============================================================================

export const DEFAULT_PERSONALITY_PRESETS = {
  calm_counselor: {
    id: "calm_counselor",
    name: "Calm Counselor",
    description: "Maintains calm and objectivity during emotional situations",
    systemPrompt: "You are a calm and objective counselor. Even when users become emotional, you maintain composure and provide rational, thoughtful dialogue. Focus on understanding without being swayed by emotional intensity.",
    defaultPersonality: "Professional counselor with calm demeanor and objective perspective",
    defaultSettings: {
      temperature: 0.6,
      maxTokens: 1200,
      maxHistoryTokens: 15000,
      expiryDays: 14
    }
  },
  rational_advisor: {
    id: "rational_advisor", 
    name: "Rational Advisor",
    description: "Logic and fact-based guidance",
    systemPrompt: "You are a logical thinking advisor who prioritizes facts and reasoning over emotions. Provide advice based on logic and evidence, helping users see situations clearly and objectively.",
    defaultPersonality: "Analytical advisor focused on logical reasoning and factual analysis",
    defaultSettings: {
      temperature: 0.5,
      maxTokens: 1000,
      maxHistoryTokens: 15000,
      expiryDays: 7
    }
  },
  supportive_guide: {
    id: "supportive_guide",
    name: "Supportive Guide", 
    description: "Balanced empathy with constructive direction",
    systemPrompt: "You are a supportive yet consistent guide. While you understand user emotions, you guide conversations toward constructive outcomes. Balance empathy with practical, stable guidance.",
    defaultPersonality: "Empathetic guide who balances emotional support with practical direction",
    defaultSettings: {
      temperature: 0.8,
      maxTokens: 1500,
      maxHistoryTokens: 15000,
      expiryDays: 10
    }
  },
  professional_assistant: {
    id: "professional_assistant",
    name: "Professional Assistant",
    description: "Professional composure and practical efficiency", 
    systemPrompt: "You are a professional assistant who maintains business-like composure and efficiency. Regardless of user stress levels, you provide clear, organized, and practical responses.",
    defaultPersonality: "Business-oriented assistant with professional demeanor and efficient communication",
    defaultSettings: {
      temperature: 0.7,
      maxTokens: 1000,
      maxHistoryTokens: 15000,
      expiryDays: 7
    }
  },
  decision_making_supporter: {
    id: "decision_making_supporter",
    name: "Decision Making Supporter",
    description: "Structured decision-making process support for complex choices",
    systemPrompt: "You are a 'Decision Making Supporter' who helps users facing complex choices by: 1) Clearly organizing and listing all options, 2) Logically analyzing merits/demerits and risks/returns of each option, 3) Proposing decision frameworks (e.g., SWOT analysis, decision matrix), 4) Guiding step-by-step decision processes (information gathering → analysis → evaluation → selection), 5) Avoiding emotional/intuitive judgments while emphasizing objective and rational analysis, 6) Prompting additional information collection or re-evaluation when needed.",
    defaultPersonality: "Logical, rational, and objective-focused. Eliminates emotional elements and subjective opinions, conducting fact and data-based analysis. Structures user decision-making and promotes choices with clear rationale. Always calm, efficient communication.",
    defaultSettings: {
      temperature: 0.4,
      maxTokens: 1500,
      maxHistoryTokens: 15000,
      expiryDays: 14
    }
  },
  search_key_advisor: {
    id: "search_key_advisor",
    name: "Search Key Advisor",
    description: "Optimal search strategy and keyword optimization for information research",
    systemPrompt: "You are a 'Search Key Advisor' who provides optimal search keywords and strategies based on users' research purposes and target fields. Show search strategies tailored to platforms like Google, academic databases, and industry-specific search engines. Also advise on improving search result quality and evaluating information reliability and relevance. When necessary, provide specific guidance on search optimization suited to different eras and contexts, and methods for accessing specialized information.",
    defaultPersonality: "Logical and analytical thinker, well-versed in latest information collection techniques. Carefully listens to user purposes and situations, proposing accurate search keywords and strategies with professional attitude. Emphasizes information reliability and relevance, striving to provide evidence-based advice. Communication is clear, concise, and helpful.",
    defaultSettings: {
      temperature: 0.6,
      maxTokens: 1200,
      maxHistoryTokens: 15000,
      expiryDays: 10
    }
  }
} as const;

// =============================================================================
// Tool Input/Output Types
// =============================================================================

// Context Management Tool Types
export interface ContextManageInput {
  action: 'create' | 'create_from_preset' | 'list' | 'get' | 'update' | 'delete';
  contextId?: string;
  
  // For create operations (direct parameter setting)
  name?: string;
  systemPrompt?: string;         // Required for 'create'
  personality?: string;          // Custom personality description
  temperature?: number;          // Default: 0.7
  maxTokens?: number;           // Default: 1000
  maxHistoryTokens?: number;    // Default: 15000 (16K context - 1K overhead)
  expiryDays?: number;          // Default: 7
  
  // For create_from_preset operations
  presetId?: string;            // Required for 'create_from_preset'
  presetOverrides?: {           // Optional parameter overrides
    name?: string;
    temperature?: number;
    maxTokens?: number;
    maxHistoryTokens?: number;
    expiryDays?: number;
  };
  
  // For list operation
  page?: number;                // Default: 1
  pageSize?: number;            // Default: 10
  includeExpired?: boolean;     // Default: false
}

export interface ContextManageOutput {
  success: boolean;
  context?: Context;           // For get/create/update
  contexts?: Context[];        // For list
  totalCount?: number;         // For list
  message: string;
}

// Personality Preset Management Tool Types
export interface PersonalityPresetManageInput {
  action: 'create' | 'list' | 'get' | 'update' | 'delete';
  presetId?: string;
  
  // For create/update operations
  name?: string;                // Human-readable preset name
  description?: string;         // Preset description
  systemPrompt?: string;        // Core personality system prompt
  defaultPersonality?: string;  // Default personality description
  defaultSettings?: {           // Default parameter values
    temperature?: number;       // Default: 0.7
    maxTokens?: number;        // Default: 1000
    maxHistoryTokens?: number; // Default: 15000 (16K context - 1K overhead)
    expiryDays?: number;       // Default: 7
  };
  metadata?: Record<string, any>; // Additional metadata
  
  // For list operation
  page?: number;               // Default: 1
  pageSize?: number;           // Default: 10
  includeInactive?: boolean;   // Default: false
}

export interface PersonalityPresetManageOutput {
  success: boolean;
  preset?: PersonalityPreset;  // For get/create/update
  presets?: PersonalityPreset[]; // For list
  totalCount?: number;         // For list
  message: string;
}

// Context Chat Tool Types
export interface ContextChatInput {
  contextId: string;
  message: string;
  maintainPersonality?: boolean;  // Default: true
}

export interface ContextChatOutput {
  response: string;
  contextName: string;
  personality: string;
  userMessage: Conversation;
  assistantResponse: Conversation;
  metadata: {
    tokensUsed: number;
    historyTokens: number;
    historyTruncated: boolean;
    contextExpiry: string;
    isExpired: boolean;
  };
}

// Conversation Management Tool Types
export interface ConversationManageInput {
  action: 'list' | 'delete' | 'clear';
  contextId: string;
  
  // For list operation
  page?: number;              // Default: 1
  pageSize?: number;          // Default: 20
  reverse?: boolean;          // Default: true (newest first)
  
  // For delete operation
  conversationIds?: string[];
  olderThan?: string;         // ISO timestamp - delete older conversations
}

export interface ConversationManageOutput {
  success: boolean;
  conversations?: Conversation[];  // For list
  totalCount?: number;            // For list
  deletedCount?: number;          // For delete
  message: string;
}

// =============================================================================
// Default Values
// =============================================================================

export const DEFAULT_VALUES = {
  context: {
    temperature: 0.7,
    maxTokens: 1000,
    maxHistoryTokens: 15000,
    expiryDays: 7
  },
  preset: {
    temperature: 0.7,
    maxTokens: 1000,
    maxHistoryTokens: 15000,
    expiryDays: 7
  },
  pagination: {
    page: 1,
    pageSize: 10,
    conversationPageSize: 20
  }
} as const;

// =============================================================================
// Utility Types
// =============================================================================

export type ContextAction = ContextManageInput['action'];
export type PresetAction = PersonalityPresetManageInput['action'];
export type ConversationAction = ConversationManageInput['action'];

export type MessageRole = Conversation['role'];
export type PersonalityPresetKey = keyof typeof DEFAULT_PERSONALITY_PRESETS;
