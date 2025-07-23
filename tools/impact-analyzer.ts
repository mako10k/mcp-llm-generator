/**
 * MCP Shell Server用のインターセプター
 * コマンド実行前に自動的に本番環境操作をチェック
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

export function interceptShellCommand(command: string): void {
    const isDangerous = DANGEROUS_COMMANDS.some(dangerousCmd => 
        command.includes(dangerousCmd)
    );
    
    const affectsProduction = PRODUCTION_PATHS.some(path => 
        command.includes(path)
    );
    
    if (isDangerous || affectsProduction) {
        throw new Error(`🚨 PRODUCTION ENVIRONMENT OPERATION BLOCKED: ${command}\n` +
                       `❌ User approval required for production operations\n` +
                       `Please use: npm run production:update (with approval)`);
    }
}

/**
 * 影響度分析レポート生成
 */
export function generateImpactAnalysis(command: string): {
    isProduction: boolean;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    requiredApprovals: string[];
    recommendation: string;
} {
    const isProduction = command.includes('build-production') || 
                        command.includes('cp -r build build-production');
    
    if (isProduction) {
        return {
            isProduction: true,
            riskLevel: 'CRITICAL',
            requiredApprovals: ['user-explicit-approval', 'qa-process-completion'],
            recommendation: 'Use npm run production:update with explicit approval'
        };
    }
    
    return {
        isProduction: false,
        riskLevel: 'LOW',
        requiredApprovals: [],
        recommendation: 'Command is safe to execute'
    };
}
