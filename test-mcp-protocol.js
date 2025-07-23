#!/usr/bin/env node
/**
 * MCP Protocol Test Script
 * clientInfo validation error の再現テスト
 */

import { spawn } from 'child_process';
import { createWriteStream } from 'fs';

console.log('🔍 MCPプロトコル clientInfo バリデーションエラーのテスト開始...\n');

// テストケース1: 正常なclientInfo
const testCase1 = {
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "roots": {"listChanged": true},
      "sampling": {}
    },
    "clientInfo": {
      "name": "test-client",
      "version": "1.0.0"
    }
  }
};

// テストケース2: clientInfo不足
const testCase2 = {
  "jsonrpc": "2.0",
  "id": 2,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "roots": {"listChanged": true},
      "sampling": {}
    }
    // clientInfo 不足
  }
};

// テストケース3: clientInfo形式不正
const testCase3 = {
  "jsonrpc": "2.0",
  "id": 3,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "roots": {"listChanged": true},
      "sampling": {}
    },
    "clientInfo": {
      "name": "test-client"
      // version 不足
    }
  }
};

async function runTest(testCase, description) {
  console.log(`\n📋 ${description}`);
  console.log(`入力: ${JSON.stringify(testCase, null, 2)}`);
  
  return new Promise((resolve) => {
    const child = spawn('node', ['build/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: '/home/mako10k/mcp-sampler'
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      console.log(`終了コード: ${code}`);
      console.log(`STDOUT: ${stdout}`);
      if (stderr) {
        console.log(`STDERR: ${stderr}`);
      }
      resolve({ code, stdout, stderr });
    });

    // テストデータを送信
    child.stdin.write(JSON.stringify(testCase) + '\n');
    child.stdin.end();

    // タイムアウト設定（3秒）
    setTimeout(() => {
      if (!child.killed) {
        child.kill();
        console.log('❌ タイムアウトでプロセス終了');
        resolve({ code: -1, stdout, stderr, timeout: true });
      }
    }, 3000);
  });
}

async function main() {
  try {
    // テストケース1: 正常なclientInfo
    await runTest(testCase1, "テストケース1: 正常なclientInfo");
    
    // テストケース2: clientInfo不足
    await runTest(testCase2, "テストケース2: clientInfo不足");
    
    // テストケース3: clientInfo形式不正
    await runTest(testCase3, "テストケース3: clientInfo形式不正");
    
    console.log('\n✅ すべてのテストケース完了');
  } catch (error) {
    console.error('❌ テスト実行エラー:', error);
  }
}

main();
