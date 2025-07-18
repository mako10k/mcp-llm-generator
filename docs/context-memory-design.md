# Context Memory System Design

## Overview

This document outlines the design for the Context Memory System, a conversation management feature for the MCP LLM Generator. The system provides persistent context management with stable personality-driven LLM interactions that maintain consistency regardless of user emotional states.

## Purpose

**Primary Goal**: Provide LLM with stable, consistent personality contexts that remain calm and rational even when users become emotional or reactive. This creates a reliable "conversation partner" that maintains professional composure and logical thinking patterns.

## Core Requirements

### 1. Context Management (Primary)
- **Context Creation**: Create conversation contexts with stable personality definitions
- **Context Viewing**: Browse and inspect existing contexts with personality summaries
- **Context Editing**: Update personality parameters and conversation settings
- **Context Deletion**: Remove contexts with automatic expiry management

### 2. Personality-Driven Chat (Main Feature)
- **Stable Interaction**: Maintain consistent personality regardless of user emotional state
- **Conversation Continuity**: Preserve conversation history within personality context
- **Automatic Expiry**: Contexts expire after configurable duration (default: 7 days)
- **LLM Integration**: Use MCP sampling for generating personality-consistent responses

### 3. Conversation Management (Secondary)
- **History Viewing**: Access conversation history with pagination
- **Selective Deletion**: Remove specific conversations or old conversations
- **Token Management**: Automatic history truncation to stay within limits

## Data Models

### Context Structure (SQLite)
```typescript
interface Context {
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
```

### Conversation Structure (SQLite)
```typescript
interface Conversation {
  id: string;           // Unique conversation identifier
  contextId: string;    // Foreign key to context
  role: 'user' | 'assistant' | 'system'; // Message role
  content: string;      // Message content
  tokenCount: number;   // Estimated token count
  createdAt: string;    // ISO timestamp
}
```

### Personality Preset Structure (SQLite)
```typescript
interface PersonalityPreset {
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
```

### Default Personality Templates
**Note**: These are initial built-in personality presets, NOT related to the existing template system.

```typescript
const DEFAULT_PERSONALITY_PRESETS = {
  calm_counselor: {
    id: "preset-calm-counselor",
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
    id: "preset-rational-advisor", 
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
    id: "preset-supportive-guide",
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
    id: "preset-professional-assistant",
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
    id: "preset-decision-making-supporter",
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
    id: "preset-search-key-advisor",
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
};
```

## API Design

### Tools (4 Multi-functional Tools)

#### 1. context-manage
**Purpose**: Comprehensive context lifecycle management
```typescript
Input: {
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

Output: {
  success: boolean;
  context?: Context;           // For get/create/update
  contexts?: Context[];        // For list
  totalCount?: number;         // For list
  message: string;
}
```

#### 2. personality-preset-manage
**Purpose**: Management of predefined personality presets (separate from template system)
```typescript
Input: {
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

Output: {
  success: boolean;
  preset?: PersonalityPreset;  // For get/create/update
  presets?: PersonalityPreset[]; // For list
  totalCount?: number;         // For list
  message: string;
}
```

#### 3. context-chat
**Purpose**: Main conversation feature with personality-driven responses
```typescript
Input: {
  contextId: string;
  message: string;
  maintainPersonality?: boolean;  // Default: true
}

Output: {
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
```

#### 4. conversation-manage
**Purpose**: Conversation history management
```typescript
Input: {
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

Output: {
  success: boolean;
  conversations?: Conversation[];  // For list
  totalCount?: number;            // For list
  deletedCount?: number;          // For delete
  message: string;
}
```

### Resources

#### 1. context-list
**URI**: `mcp-llm-generator://contexts`
**Purpose**: Dynamic list of all active contexts with personality summaries

#### 2. context-detail
**URI**: `mcp-llm-generator://context/{contextId}`
**Purpose**: Detailed context information including personality and recent conversations

#### 3. personality-templates
**URI**: `mcp-llm-generator://personality-templates`
**Purpose**: Available personality templates for context creation

#### 4. personality-presets
**URI**: `mcp-llm-generator://personality-presets`
**Purpose**: Available personality presets for context creation (separate from template system)

#### 5. preset-detail
**URI**: `mcp-llm-generator://preset/{presetId}`
**Purpose**: Detailed personality preset information including default settings

### Prompts

#### 1. personality-creator
**Purpose**: Template for creating custom personalities
```typescript
Args: {
  role: string;           // Desired personality role
  traits: string;         // Key personality traits
  scenario: string;       // Primary use scenario
}
```

#### 2. context-summary
**Purpose**: Template for summarizing context interactions
```typescript
Args: {
  contextName: string;
  personality: string;
  interactionCount: number;
  timeSpan: string;
}
```

## Database Schema (SQLite)

### Tables

#### Contexts Table
```sql
CREATE TABLE contexts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  personality TEXT NOT NULL,
  temperature REAL DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 1000,
  max_history_tokens INTEGER DEFAULT 15000,
  expiry_days INTEGER DEFAULT 7,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  is_active BOOLEAN DEFAULT 1
);

CREATE INDEX idx_contexts_active ON contexts(is_active);
CREATE INDEX idx_contexts_expiry ON contexts(expires_at);
```

#### Personality Presets Table
```sql
CREATE TABLE personality_presets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  default_personality TEXT NOT NULL,
  default_temperature REAL DEFAULT 0.7,
  default_max_tokens INTEGER DEFAULT 1000,
  default_max_history_tokens INTEGER DEFAULT 15000,
  default_expiry_days INTEGER DEFAULT 7,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  is_active BOOLEAN DEFAULT 1,
  metadata TEXT -- JSON string for additional metadata
);

CREATE INDEX idx_presets_active ON personality_presets(is_active);
CREATE INDEX idx_presets_name ON personality_presets(name);
```

#### Conversations Table
```sql
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  context_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  token_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (context_id) REFERENCES contexts(id) ON DELETE CASCADE
);

CREATE INDEX idx_conversations_context ON conversations(context_id);
CREATE INDEX idx_conversations_created_at ON conversations(created_at);
```

## File Structure

### Database Storage
- **Location**: `./data/contexts.db`
- **Format**: SQLite database
- **Backup**: Automatic daily backup to `./data/backups/`

### Implementation Files
```
src/
├── context.ts              # Main context management implementation
├── personalityPreset.ts    # Personality preset management implementation
├── types/
│   ├── context.ts         # Context-related type definitions
│   └── personalityPreset.ts # Preset-related type definitions
└── utils/
    ├── contextDatabase.ts    # SQLite database operations for contexts
    ├── presetDatabase.ts     # SQLite database operations for presets
    ├── tokenCounter.ts       # Token counting utilities
    ├── personalityManager.ts # Personality template management
    └── contextExpiry.ts      # Expiry management utilities
```

## Personality Management Strategy

### Clear Separation from Existing Template System
**Important**: The personality preset system is completely separate from the existing MCP template system:

1. **Different Purpose**:
   - **Existing Templates**: General-purpose text generation templates
   - **Personality Presets**: Conversation context configuration for consistent AI personas

2. **Different Storage**:
   - **Existing Templates**: File-based storage in template management system
   - **Personality Presets**: SQLite database storage with context system

3. **Different Usage**:
   - **Existing Templates**: Used with `template-execute` and `template-manage` tools
   - **Personality Presets**: Used with `context-manage` and `personality-preset-manage` tools

4. **No Cross-Dependencies**:
   - Both systems operate independently
   - No shared data structures or dependencies
   - Separate CRUD operations and validation

### Preset Management Strategy
1. **Predefined Presets**: 6 built-in personality presets (4 stable + 2 experimental)
2. **Custom Personalities**: Users can define custom personalities
3. **Experimental Features**: Decision Making Supporter and Search Key Advisor include experimental elements for feedback-based improvement
4. **Consistency Enforcement**: System prompts designed to maintain personality under stress
5. **Preset Validation**: Validate personality prompts for effectiveness

### Personality Persistence
- **Conversation Memory**: Personality context maintained throughout conversation
- **Emotional Resilience**: Designed to not be swayed by user emotional states
- **Professional Boundaries**: Maintain appropriate response patterns

### Experimental Personality Features
**Decision Making Supporter** and **Search Key Advisor** include experimental elements:

1. **Advanced Frameworks**: Testing structured decision-making and search optimization methodologies
2. **Adaptive Responses**: Experimental response patterns based on context complexity
3. **Feedback Integration**: Designed to evolve based on user interaction patterns
4. **Performance Metrics**: Track effectiveness of specialized guidance approaches
5. **Iterative Improvement**: Regular updates based on usage analytics and user feedback

**Note**: Experimental personalities may undergo modifications based on real-world usage patterns and user feedback to optimize their effectiveness.

## Token Management Strategy

### Context Window Sizing
**Default Configuration**: The system is configured for 16K token context windows with the following guidelines:

1. **Default maxHistoryTokens**: 15,000 tokens (16K - 1K overhead)
2. **Overhead Allocation**: 1,000 tokens reserved for:
   - System prompts (200-400 tokens)
   - Response generation space (400-600 tokens)  
   - Protocol overhead and safety margin (200-400 tokens)

3. **Custom Context Window Sizing**: 
   - **For known context limits**: Set `maxHistoryTokens = (your_context_limit - 1000)`
   - **For 32K models**: Recommended `maxHistoryTokens = 31000`
   - **For 8K models**: Recommended `maxHistoryTokens = 7000`
   - **For 4K models**: Recommended `maxHistoryTokens = 3000`

### History Management
1. **Soft Limit Warning**: At 80% of `maxHistoryTokens`
2. **Hard Limit Truncation**: Automatic oldest-first removal
3. **Conversation Pair Preservation**: Remove complete user-assistant pairs
4. **System Prompt Protection**: Always preserve personality system prompt

### Token Counting
- **Estimation Method**: Character-based approximation (4 chars ≈ 1 token)
- **Real-time Tracking**: Update token counts on each interaction
- **Efficiency**: Batch calculations for multiple conversations

## Expiry Management

### Automatic Expiry
- **Default Duration**: 7 days from last interaction
- **Expiry Check**: Automatic check on each access
- **Grace Period**: 24-hour warning before expiry
- **Extension Option**: Allow users to extend expiry

### Cleanup Strategy
- **Soft Delete**: Mark as inactive rather than immediate deletion
- **Backup Creation**: Automatic backup before deletion
- **Batch Cleanup**: Daily cleanup job for expired contexts

## Error Handling

### Context Errors
- **Not Found**: Return descriptive error with available context list
- **Invalid Parameters**: Validate input parameters with detailed feedback
- **Storage Errors**: Handle file I/O errors gracefully with fallback options

### Conversation Errors
- **Index Out of Range**: Clear error messages for invalid positions
- **Token Limit Exceeded**: Automatic handling with user notification
- **Invalid Role**: Validate conversation roles strictly

## Security Considerations

### Data Protection
- **File Permissions**: Restrict access to context data files
- **Input Validation**: Sanitize all user inputs
- **Path Traversal**: Prevent directory traversal attacks in contextId

### Resource Limits
- **Context Limit**: Maximum number of contexts per instance
- **Conversation Limit**: Maximum conversations per context
- **File Size Limit**: Maximum context file size

## Performance Optimization

### Caching Strategy
- **In-Memory Cache**: Keep frequently accessed contexts in memory
- **Lazy Loading**: Load conversation history on demand
- **Batch Operations**: Optimize multi-conversation operations

### Indexing
- **Context Index**: Maintain index of all contexts for fast lookup
- **Search Optimization**: Enable fast searching within conversations
- **Pagination**: Efficient pagination for large conversation histories

## Future Enhancements

### Phase 2 Features
- **Search**: Full-text search across conversations
- **Export**: Export contexts in various formats (JSON, Markdown, etc.)
- **Import**: Import conversations from external sources
- **Tagging**: Tag contexts and conversations for organization
- **Templates**: Context templates for common use cases

### Integration Features
- **Backup Service**: Cloud backup integration
- **Collaboration**: Multi-user context sharing
- **Analytics**: Conversation pattern analysis
- **AI Insights**: Automatic conversation summarization and insights

## Testing Strategy

### Unit Tests
- Context CRUD operations
- Conversation manipulation
- Token counting accuracy
- File I/O operations

### Integration Tests
- End-to-end conversation flows
- LLM integration with contexts
- Error handling scenarios
- Performance under load

### Manual Testing
- User experience scenarios
- Edge cases and error conditions
- Performance with large datasets
- Cross-platform compatibility

## Migration Strategy

### Version Compatibility
- **Data Format Versioning**: Include version in context files
- **Migration Scripts**: Automatic migration for format changes
- **Backward Compatibility**: Support for older context formats

### Deployment
- **Gradual Rollout**: Feature flags for gradual deployment
- **Monitoring**: Track usage and performance metrics
- **Rollback Plan**: Quick rollback capability if issues arise
