#!/usr/bin/env node
/**
 * Production Environment Guard
 * 本番環境操作の自動検出・防止ツール
 */

const PRODUCTION_PATHS = [
    'build-production',
    'build-production/',
    './build-production',
    './build-production/'
];

const DANGEROUS_COMMANDS = [
    'cp -r build build-production',
    'rm -rf build-production',
    'mv build-production',
    'chmod build-production',
    'chown build-production'
];

function checkCommand(command) {
    const isDangerous = DANGEROUS_COMMANDS.some(dangerousCmd => 
        command.includes(dangerousCmd)
    );
    
    const affectsProduction = PRODUCTION_PATHS.some(path => 
        command.includes(path)
    );
    
    if (isDangerous || affectsProduction) {
        console.error('🚨 PRODUCTION ENVIRONMENT OPERATION DETECTED');
        console.error('Command:', command);
        console.error('❌ BLOCKED: User approval required for production operations');
        console.error('Please use: npm run production:update (with approval)');
        process.exit(1);
    }
}

// コマンドライン引数から実行予定コマンドをチェック
const command = process.argv.slice(2).join(' ');
if (command) {
    checkCommand(command);
}

module.exports = { checkCommand };
