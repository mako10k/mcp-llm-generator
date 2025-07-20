/**
 * Output Schema Builder
 * 出力スキーマ生成のStrategy実装
 */
import { BasePromptSectionBuilder } from './PromptSectionBuilder.js';
export class OutputSchemaBuilder extends BasePromptSectionBuilder {
    constructor(config) {
        super({
            enabled: true,
            priority: 9, // 高優先度
            ...config
        });
    }
    getSectionName() {
        return 'Output Schema';
    }
    build(context) {
        return `## Output Format

You MUST respond with a JSON object that follows this exact schema:

\`\`\`json
{
  "should_call_tool": boolean,
  "tool_calls": [
    {
      "tool_name": "string",
      "arguments": {
        // Tool-specific parameters as key-value pairs
      },
      "confidence": number, // 0.0 to 1.0
      "reasoning": "string"
    }
  ],
  "response_text": "string",
  "metadata": {
    "processing_time": number, // optional
    "model_used": "string", // optional
    "confidence_score": number // optional, 0.0 to 1.0
  }
}
\`\`\`

**Critical Requirements**:
- Set \`should_call_tool\` to \`true\` only if tools are necessary
- Include \`tool_calls\` array even if empty
- Provide confidence scores between 0.0 and 1.0
- Include clear reasoning for each tool call
- Generate appropriate response text regardless of tool usage
- No additional properties allowed (strict mode)`;
    }
}
