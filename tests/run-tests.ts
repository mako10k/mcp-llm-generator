#!/usr/bin/env node
/**
 * SharedMemoryCore テスト実行スクリプト
 */

import { runTests } from './shared-memory-core.test.js';

async function main() {
  try {
    await runTests();
    console.log('\n🎉 All SharedMemoryCore tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Tests failed:', error);
    process.exit(1);
  }
}

main();
