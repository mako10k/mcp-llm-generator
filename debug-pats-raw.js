const { ContextMemoryTools } = require('./build-production/contextMemory/tools/index.js');

async function testPATsRawOutput() {
  const tools = new ContextMemoryTools();
  
  console.error('=== PATs Function Call Debug Test ===');
  
  try {
    // Create test context
    const context = await tools.context_manage({
      action: 'create',
      name: 'PATs_Debug_Context',
      personality: 'You MUST use Google search tools when asked to search. Always set should_call_tool: true for search requests.',
      systemPrompt: `You MUST use pats_google_search when asked to search.

Available tools:
- pats_google_search

Always respond with this JSON format for searches:
{
  "should_call_tool": true,
  "tool_calls": [
    {
      "toolName": "pats_google_search",
      "parameters": {
        "query": "search terms",
        "numResults": 3
      }
    }
  ],
  "response_text": "Searching..."
}`,
      maxTokens: 1000,
      temperature: 0.1
    });
    
    console.error('Context created:', context.contextId);
    
    // Intercept the LLM call to see raw output
    const result = await tools.context_chat({
      contextId: context.contextId,
      message: 'Search for AI technology information',
      maintainPersonality: true
    });
    
    console.error('Final result:');
    console.error(JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testPATsRawOutput();
