/**
 * Example Builder
 * プロンプト例生成のStrategy実装
 */
import { BasePromptSectionBuilder } from './PromptSectionBuilder.js';
export class ExampleBuilder extends BasePromptSectionBuilder {
    constructor(config) {
        super({
            enabled: true,
            priority: 6,
            maxLength: 1500,
            ...config
        });
    }
    getSectionName() {
        return 'Examples';
    }
    build(context) {
        const content = `## Examples

### Example 1: Tool Call Required
User: "Search for recent articles about AI"
Response:
\`\`\`json
{
  "should_call_tool": true,
  "tool_calls": [
    {
      "tool_name": "search_articles",
      "arguments": {
        "query": "AI recent articles",
        "time_range": "recent"
      },
      "confidence": 0.9,
      "reasoning": "User explicitly requested a search for recent AI articles, which matches the search_articles tool functionality"
    }
  ],
  "response_text": "I'll search for recent articles about AI for you.",
  "metadata": {
    "confidence_score": 0.9
  }
}
\`\`\`

### Example 2: No Tool Required
User: "What is artificial intelligence?"
Response:
\`\`\`json
{
  "should_call_tool": false,
  "tool_calls": [],
  "response_text": "Artificial intelligence (AI) is a branch of computer science that aims to create machines capable of performing tasks that typically require human intelligence...",
  "metadata": {
    "confidence_score": 0.8
  }
}
\`\`\``;
        return this.truncateIfNeeded(content);
    }
}
