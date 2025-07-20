#!/usr/bin/env node
/**
 * 統合された共有メモリツールの簡単テスト
 */

import { spawn } from 'child_process';

async function testIntegratedSharedMemoryTools() {
  console.log('🧪 統合共有メモリツールテスト開始...');
  
  const child = spawn('node', ['build/index.js'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: process.cwd()
  });

  child.stderr.on('data', (data) => {
    console.log('Server Log:', data.toString());
  });

  // 1秒待機（サーバー初期化）
  await new Promise(resolve => setTimeout(resolve, 1000));

  // ツールリスト取得テスト
  console.log('\n📋 ツールリスト取得テスト');
  const toolsListRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
    params: {}
  };

  child.stdin.write(JSON.stringify(toolsListRequest) + '\n');

  let responseData = '';
  const responseTimeout = setTimeout(() => {
    console.log('⚠️ レスポンスタイムアウト');
    child.kill();
  }, 5000);

  child.stdout.on('data', (data) => {
    responseData += data.toString();
    const lines = responseData.split('\n');
    
    for (const line of lines) {
      if (line.trim()) {
        try {
          const response = JSON.parse(line);
          if (response.id === 1) {
            clearTimeout(responseTimeout);
            console.log('\n📋 利用可能ツール:');
            
            const sharedMemoryTools = response.result.tools.filter(tool => 
              tool.name.startsWith('shared-memory-')
            );
            
            if (sharedMemoryTools.length > 0) {
              console.log('✅ 共有メモリツールが正常に統合されました:');
              sharedMemoryTools.forEach(tool => {
                console.log(`   - ${tool.name}: ${tool.description}`);
              });
            } else {
              console.log('❌ 共有メモリツールが見つかりません');
            }
            
            console.log(`\n📊 総ツール数: ${response.result.tools.length}`);
            child.kill();
            return;
          }
        } catch (error) {
          // JSON パースエラーは無視
        }
      }
    }
  });

  // プロセス終了待機
  return new Promise((resolve) => {
    child.on('close', (code) => {
      console.log(`\n✅ テスト完了 (exit code: ${code})`);
      resolve(code);
    });
  });
}

// テスト実行
testIntegratedSharedMemoryTools().catch(console.error);
