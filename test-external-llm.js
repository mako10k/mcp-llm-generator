#!/usr/bin/env node
/**
 * 外部LLM API統合機能のテスト
 * OpenAI API、Claude API の動作確認
 */

import { spawn } from 'child_process';

console.log('🧪 外部LLM API統合機能のテスト開始...\n');

// テストケース1: プロバイダー情報の取得
const testProvidersInfo = {
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "external-llm-providers",
    "arguments": {
      "healthCheck": false
    }
  }
};

// テストケース2: 内部MCP生成（デフォルト）
const testInternalGeneration = {
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "external-llm-generate",
    "arguments": {
      "messages": [
        {"role": "user", "content": "Hello, can you respond with just 'Working' in one word?"}
      ],
      "maxTokens": 10,
      "temperature": 0.1
    }
  }
};

// テストケース3: OpenAI API（環境変数が設定されている場合）
const testOpenAIGeneration = {
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "external-llm-generate",
    "arguments": {
      "messages": [
        {"role": "user", "content": "Say 'OpenAI Working' in exactly those words."}
      ],
      "provider": "openai",
      "model": "gpt-4o-mini",
      "maxTokens": 10,
      "temperature": 0.1
    }
  }
};

// テストケース4: Claude API（環境変数が設定されている場合）
const testClaudeGeneration = {
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "external-llm-generate",
    "arguments": {
      "messages": [
        {"role": "user", "content": "Say 'Claude Working' in exactly those words."}
      ],
      "provider": "claude",
      "model": "claude-3-5-haiku-20241022",
      "maxTokens": 10,
      "temperature": 0.1
    }
  }
};

async function initializeServer() {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['build/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: '/home/mako10k/mcp-sampler'
    });

    let initialized = false;

    child.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Context Memory System initialized successfully') && !initialized) {
        initialized = true;
        resolve(child);
      }
    });

    child.stderr.on('data', (data) => {
      const output = data.toString();
      if (output.includes('is running on stdio') && !initialized) {
        initialized = true;
        resolve(child);
      }
    });

    child.on('exit', (code) => {
      if (!initialized) {
        reject(new Error(`Server failed to start with exit code: ${code}`));
      }
    });

    // Initialize the server
    const initMessage = {
      "jsonrpc": "2.0",
      "id": 0,
      "method": "initialize",
      "params": {
        "protocolVersion": "2024-11-05",
        "capabilities": {
          "roots": {"listChanged": true},
          "sampling": {}
        },
        "clientInfo": {
          "name": "llm-api-test-client",
          "version": "1.0.0"
        }
      }
    };

    child.stdin.write(JSON.stringify(initMessage) + '\\n');

    setTimeout(() => {
      if (!initialized) {
        child.kill();
        reject(new Error('Server initialization timeout'));
      }
    }, 5000);
  });
}

async function runTestCase(child, testCase, description) {
  console.log(`\\n🔬 ${description}`);
  console.log(`Request: ${JSON.stringify(testCase, null, 2)}`);
  
  return new Promise((resolve) => {
    let response = '';
    
    const timeout = setTimeout(() => {
      console.log('❌ タイムアウト (10秒)');
      resolve({ timeout: true });
    }, 10000);

    const dataHandler = (data) => {
      const output = data.toString();
      if (output.includes(`"id":${testCase.id}`)) {
        try {
          const lines = output.split('\\n');
          for (const line of lines) {
            if (line.trim() && line.includes(`"id":${testCase.id}`)) {
              const result = JSON.parse(line);
              clearTimeout(timeout);
              child.stdout.removeListener('data', dataHandler);
              resolve(result);
              return;
            }
          }
        } catch (parseError) {
          // Continue waiting for valid JSON
        }
      }
    };

    child.stdout.on('data', dataHandler);
    child.stdin.write(JSON.stringify(testCase) + '\\n');
  });
}

async function main() {
  let child;
  
  try {
    // サーバー初期化
    console.log('🚀 MCPサーバーを初期化中...');
    child = await initializeServer();
    console.log('✅ MCPサーバー初期化完了');

    // テストケース1: プロバイダー情報
    const result1 = await runTestCase(child, testProvidersInfo, 'プロバイダー情報の取得');
    console.log(`Response: ${JSON.stringify(result1, null, 2)}`);

    // テストケース2: 内部MCP生成
    const result2 = await runTestCase(child, testInternalGeneration, '内部MCP生成テスト');
    console.log(`Response: ${JSON.stringify(result2, null, 2)}`);

    // 環境変数をチェック
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasClaude = !!process.env.ANTHROPIC_API_KEY;
    
    console.log(`\\n🔍 環境変数確認:`);
    console.log(`OPENAI_API_KEY: ${hasOpenAI ? '✅ 設定済み' : '❌ 未設定'}`);
    console.log(`ANTHROPIC_API_KEY: ${hasClaude ? '✅ 設定済み' : '❌ 未設定'}`);

    // テストケース3: OpenAI API
    if (hasOpenAI) {
      const result3 = await runTestCase(child, testOpenAIGeneration, 'OpenAI API テスト');
      console.log(`Response: ${JSON.stringify(result3, null, 2)}`);
    } else {
      console.log('\\n⚠️ OpenAI API テストをスキップ（API キー未設定）');
    }

    // テストケース4: Claude API
    if (hasClaude) {
      const result4 = await runTestCase(child, testClaudeGeneration, 'Claude API テスト');
      console.log(`Response: ${JSON.stringify(result4, null, 2)}`);
    } else {
      console.log('\\n⚠️ Claude API テストをスキップ（API キー未設定）');
    }

    console.log('\\n✅ 全テストケース完了');

  } catch (error) {
    console.error('❌ テスト実行エラー:', error);
  } finally {
    if (child) {
      child.kill();
    }
  }
}

main();
