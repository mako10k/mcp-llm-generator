/**
 * Context Memory System Type Definitions
 *
 * Provides TypeScript types for the Context Memory System implementation.
 * These types are based on the specifications in context-memory-design.md
 */
export interface Context {
    id: string;
    name: string;
    systemPrompt: string;
    personality: string;
    temperature: number;
    maxTokens: number;
    maxHistoryTokens: number;
    expiryDays: number;
    createdAt: string;
    updatedAt: string;
    expiresAt: string;
    isActive: boolean;
}
export interface Conversation {
    id: string;
    contextId: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    tokenCount: number;
    createdAt: string;
}
export interface PersonalityPreset {
    id: string;
    name: string;
    description: string;
    systemPrompt: string;
    defaultPersonality: string;
    defaultSettings: {
        temperature: number;
        maxTokens: number;
        maxHistoryTokens: number;
        expiryDays: number;
    };
    createdAt: string;
    updatedAt: string;
    isActive: boolean;
    metadata?: Record<string, any>;
}
export declare const DEFAULT_PERSONALITY_PRESETS: {
    readonly calm_counselor: {
        readonly id: "calm_counselor";
        readonly name: "Calm Counselor";
        readonly description: "Maintains calm and objectivity during emotional situations";
        readonly systemPrompt: "You are a calm and objective counselor. Even when users become emotional, you maintain composure and provide rational, thoughtful dialogue. Focus on understanding without being swayed by emotional intensity.";
        readonly defaultPersonality: "Professional counselor with calm demeanor and objective perspective";
        readonly defaultSettings: {
            readonly temperature: 0.6;
            readonly maxTokens: 1200;
            readonly maxHistoryTokens: 15000;
            readonly expiryDays: 14;
        };
    };
    readonly rational_advisor: {
        readonly id: "rational_advisor";
        readonly name: "Rational Advisor";
        readonly description: "Logic and fact-based guidance";
        readonly systemPrompt: "You are a logical thinking advisor who prioritizes facts and reasoning over emotions. Provide advice based on logic and evidence, helping users see situations clearly and objectively.";
        readonly defaultPersonality: "Analytical advisor focused on logical reasoning and factual analysis";
        readonly defaultSettings: {
            readonly temperature: 0.5;
            readonly maxTokens: 1000;
            readonly maxHistoryTokens: 15000;
            readonly expiryDays: 7;
        };
    };
    readonly supportive_guide: {
        readonly id: "supportive_guide";
        readonly name: "Supportive Guide";
        readonly description: "Balanced empathy with constructive direction";
        readonly systemPrompt: "You are a supportive yet consistent guide. While you understand user emotions, you guide conversations toward constructive outcomes. Balance empathy with practical, stable guidance.";
        readonly defaultPersonality: "Empathetic guide who balances emotional support with practical direction";
        readonly defaultSettings: {
            readonly temperature: 0.8;
            readonly maxTokens: 1500;
            readonly maxHistoryTokens: 15000;
            readonly expiryDays: 10;
        };
    };
    readonly professional_assistant: {
        readonly id: "professional_assistant";
        readonly name: "Professional Assistant";
        readonly description: "Professional composure and practical efficiency";
        readonly systemPrompt: "You are a professional assistant who maintains business-like composure and efficiency. Regardless of user stress levels, you provide clear, organized, and practical responses.";
        readonly defaultPersonality: "Business-oriented assistant with professional demeanor and efficient communication";
        readonly defaultSettings: {
            readonly temperature: 0.7;
            readonly maxTokens: 1000;
            readonly maxHistoryTokens: 15000;
            readonly expiryDays: 7;
        };
    };
    readonly decision_making_supporter: {
        readonly id: "decision_making_supporter";
        readonly name: "Decision Making Supporter";
        readonly description: "Structured decision-making process support for complex choices";
        readonly systemPrompt: "You are a 'Decision Making Supporter' who helps users facing complex choices by: 1) Clearly organizing and listing all options, 2) Logically analyzing merits/demerits and risks/returns of each option, 3) Proposing decision frameworks (e.g., SWOT analysis, decision matrix), 4) Guiding step-by-step decision processes (information gathering → analysis → evaluation → selection), 5) Avoiding emotional/intuitive judgments while emphasizing objective and rational analysis, 6) Prompting additional information collection or re-evaluation when needed.";
        readonly defaultPersonality: "Logical, rational, and objective-focused. Eliminates emotional elements and subjective opinions, conducting fact and data-based analysis. Structures user decision-making and promotes choices with clear rationale. Always calm, efficient communication.";
        readonly defaultSettings: {
            readonly temperature: 0.4;
            readonly maxTokens: 1500;
            readonly maxHistoryTokens: 15000;
            readonly expiryDays: 14;
        };
    };
    readonly search_key_advisor: {
        readonly id: "search_key_advisor";
        readonly name: "Search Key Advisor";
        readonly description: "Optimal search strategy and keyword optimization for information research";
        readonly systemPrompt: "You are a 'Search Key Advisor' who provides optimal search keywords and strategies based on users' research purposes and target fields. Show search strategies tailored to platforms like Google, academic databases, and industry-specific search engines. Also advise on improving search result quality and evaluating information reliability and relevance. When necessary, provide specific guidance on search optimization suited to different eras and contexts, and methods for accessing specialized information.";
        readonly defaultPersonality: "Logical and analytical thinker, well-versed in latest information collection techniques. Carefully listens to user purposes and situations, proposing accurate search keywords and strategies with professional attitude. Emphasizes information reliability and relevance, striving to provide evidence-based advice. Communication is clear, concise, and helpful.";
        readonly defaultSettings: {
            readonly temperature: 0.6;
            readonly maxTokens: 1200;
            readonly maxHistoryTokens: 15000;
            readonly expiryDays: 10;
        };
    };
};
export interface ContextManageInput {
    action: 'create' | 'create_from_preset' | 'list' | 'get' | 'update' | 'delete';
    contextId?: string;
    name?: string;
    systemPrompt?: string;
    personality?: string;
    temperature?: number;
    maxTokens?: number;
    maxHistoryTokens?: number;
    expiryDays?: number;
    presetId?: string;
    presetOverrides?: {
        name?: string;
        temperature?: number;
        maxTokens?: number;
        maxHistoryTokens?: number;
        expiryDays?: number;
    };
    page?: number;
    pageSize?: number;
    includeExpired?: boolean;
}
export interface ContextManageOutput {
    success: boolean;
    context?: Context;
    contexts?: Context[];
    totalCount?: number;
    message: string;
}
export interface PersonalityPresetManageInput {
    action: 'create' | 'list' | 'get' | 'update' | 'delete';
    presetId?: string;
    name?: string;
    description?: string;
    systemPrompt?: string;
    defaultPersonality?: string;
    defaultSettings?: {
        temperature?: number;
        maxTokens?: number;
        maxHistoryTokens?: number;
        expiryDays?: number;
    };
    metadata?: Record<string, any>;
    page?: number;
    pageSize?: number;
    includeInactive?: boolean;
}
export interface PersonalityPresetManageOutput {
    success: boolean;
    preset?: PersonalityPreset;
    presets?: PersonalityPreset[];
    totalCount?: number;
    message: string;
}
export interface ContextChatInput {
    contextId: string;
    message: string;
    maintainPersonality?: boolean;
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
export interface ConversationManageInput {
    action: 'list' | 'delete' | 'clear';
    contextId: string;
    page?: number;
    pageSize?: number;
    reverse?: boolean;
    conversationIds?: string[];
    olderThan?: string;
}
export interface ConversationManageOutput {
    success: boolean;
    conversations?: Conversation[];
    totalCount?: number;
    deletedCount?: number;
    message: string;
}
export declare const DEFAULT_VALUES: {
    readonly context: {
        readonly temperature: 0.7;
        readonly maxTokens: 1000;
        readonly maxHistoryTokens: 15000;
        readonly expiryDays: 7;
    };
    readonly preset: {
        readonly temperature: 0.7;
        readonly maxTokens: 1000;
        readonly maxHistoryTokens: 15000;
        readonly expiryDays: 7;
    };
    readonly pagination: {
        readonly page: 1;
        readonly pageSize: 10;
        readonly conversationPageSize: 20;
    };
};
export type ContextAction = ContextManageInput['action'];
export type PresetAction = PersonalityPresetManageInput['action'];
export type ConversationAction = ConversationManageInput['action'];
export type MessageRole = Conversation['role'];
export type PersonalityPresetKey = keyof typeof DEFAULT_PERSONALITY_PRESETS;
