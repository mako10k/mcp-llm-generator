#!/usr/bin/env node
/**
 * 外部LLM API統合機能の簡単なテスト
 */

import { spawn } from 'child_process';

async function testExternalLLM() {
  console.log('🧪 外部LLM API統合機能の簡単テスト開始...\n');

  const child = spawn('node', ['build/index.js'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: '/home/mako10k/mcp-sampler'
  });

  // Initialize
  const initMessage = {
    "jsonrpc": "2.0",
    "id": 0,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {"roots": {"listChanged": true}, "sampling": {}},
      "clientInfo": {"name": "test-client", "version": "1.0.0"}
    }
  };

  child.stdin.write(JSON.stringify(initMessage) + '\n');

  // Wait for initialization
  await new Promise(resolve => setTimeout(resolve, 500));

  // Test providers info
  const providersTest = {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "external-llm-providers",
      "arguments": {}
    }
  };

  console.log('📋 プロバイダー情報テスト');
  child.stdin.write(JSON.stringify(providersTest) + '\n');

  // Test OpenAI generation (if API key is available)
  if (process.env.OPENAI_API_KEY) {
    const openaiTest = {
      "jsonrpc": "2.0",
      "id": 2,
      "method": "tools/call",
      "params": {
        "name": "external-llm-generate",
        "arguments": {
          "messages": [{"role": "user", "content": "Say 'Hello from OpenAI' in exactly those words"}],
          "provider": "openai",
          "model": "gpt-4o-mini",
          "maxTokens": 10
        }
      }
    };

    console.log('🤖 OpenAI API テスト');
    child.stdin.write(JSON.stringify(openaiTest) + '\n');
  } else {
    console.log('⚠️ OpenAI API キー未設定のためスキップ');
  }

  // Collect output
  let output = '';
  child.stdout.on('data', (data) => {
    output += data.toString();
  });

  // Wait for responses
  await new Promise(resolve => setTimeout(resolve, 3000));

  child.kill();

  // Parse and display results
  const lines = output.split('\n').filter(line => line.trim());
  for (const line of lines) {
    if (line.includes('"id":1') || line.includes('"id":2')) {
      try {
        const response = JSON.parse(line);
        console.log(`\n📄 Response ID ${response.id}:`);
        console.log(JSON.stringify(response, null, 2));
      } catch (e) {
        // Skip invalid JSON
      }
    }
  }

  console.log('\n✅ テスト完了');
}

testExternalLLM().catch(console.error);
