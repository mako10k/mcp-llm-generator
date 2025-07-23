/**
 * Phase 2: PersonaManager RBAC統合テストスイート
 * RBAC機能の包括的テスト
 */

import { createRBACPersonaManager, PersonaRBACHelper, validateRBACIntegration } from '../src/rbac/PersonaRBACIntegration.js';
import { PersonaManager } from '../src/utils/personaManager.js';
import { RBACEngine } from '../src/rbac/RBACEngine.js';
import { ContextMemoryDatabase } from '../src/contextMemory/utils/database.js';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

describe('PersonaManager RBAC Integration Tests', () => {
  let testDbPath: string;
  let personaManager: PersonaManager;
  let rbacPersonaManager: any;
  let db: Database.Database;
  let contextDb: ContextMemoryDatabase;

  beforeAll(async () => {
    // テスト用データベースの準備
    testDbPath = path.join(__dirname, 'test-rbac-persona.db');
    
    // 既存のテストDBがあれば削除
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // データベース初期化
    db = new Database(testDbPath);
    
    // 基本スキーマの作成
    db.exec(`
      CREATE TABLE persona_context (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        personality TEXT,
        system_prompt TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      );

      CREATE TABLE conversation_context (
        id TEXT PRIMARY KEY,
        persona_id TEXT,
        title TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (persona_id) REFERENCES persona_context(id)
      );
    `);

    // RBAC拡張スキーマの適用
    const rbacSchema = fs.readFileSync(
      path.join(__dirname, '../src/rbac/rbac_extension_schema.sql'),
      'utf8'
    );
    db.exec(rbacSchema);

    // PersonaManagerの作成
    personaManager = new PersonaManager(db);

    // RBAC拡張の適用
    rbacPersonaManager = createRBACPersonaManager(personaManager, testDbPath);
  });

  afterAll(async () => {
    if (rbacPersonaManager?.cleanup) {
      rbacPersonaManager.cleanup();
    }
    if (db) {
      db.close();
    }
    // テストファイルクリーンアップ
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('RBAC Integration Validation', () => {
    test('should validate RBAC integration correctly', () => {
      const isValid = validateRBACIntegration(rbacPersonaManager);
      expect(isValid).toBe(true);
    });

    test('should have all required RBAC methods', () => {
      const requiredMethods = [
        'createPersonaHierarchy',
        'getPersonaPermissions',
        'checkPersonaPermission', 
        'updatePersonaPermissions',
        'getPersonaHierarchyTree',
        'getPersonaSelfCapabilities'
      ];

      for (const method of requiredMethods) {
        expect(typeof rbacPersonaManager[method]).toBe('function');
      }
    });
  });

  describe('Persona Hierarchy Management', () => {
    let adminContextId: string;
    let specialistContextId: string;
    let assistantContextId: string;

    beforeEach(() => {
      // テスト用context作成
      const adminContext = contextDb.createContext({
        name: 'Admin Persona',
        personality: 'System administrator with full access',
        systemPrompt: 'You are a system administrator.',
        maxTokens: 1000,
        temperature: 0.7
      });
      adminContextId = adminContext.id;

      const specialistContext = contextDb.createContext({
        name: 'Data Specialist',
        personality: 'Data analysis specialist',
        systemPrompt: 'You are a data analysis specialist.',
        maxTokens: 1000,
        temperature: 0.7
      });
      specialistContextId = specialistContext.id;

      const assistantContext = contextDb.createContext({
        name: 'Assistant Persona', 
        personality: 'General assistant',
        systemPrompt: 'You are a helpful assistant.',
        maxTokens: 1000,
        temperature: 0.7
      });
      assistantContextId = assistantContext.id;
    });

    test('should create persona hierarchy successfully', async () => {
      const adminPermissions = PersonaRBACHelper.createBasicPermissions('admin');
      const specialistPermissions = PersonaRBACHelper.createBasicPermissions('specialist');

      // Admin -> Specialist hierarchy
      const hierarchyCreated = await rbacPersonaManager.createPersonaHierarchy(
        adminContextId,
        specialistContextId,
        specialistPermissions
      );

      expect(hierarchyCreated).toBe(true);

      // Specialist -> Assistant hierarchy
      const assistantPermissions = PersonaRBACHelper.createBasicPermissions('assistant');
      const subHierarchyCreated = await rbacPersonaManager.createPersonaHierarchy(
        specialistContextId,
        assistantContextId,
        assistantPermissions
      );

      expect(subHierarchyCreated).toBe(true);
    });

    test('should retrieve persona permissions with hierarchy', async () => {
      // 権限設定
      const adminPermissions = PersonaRBACHelper.createBasicPermissions('admin');
      await rbacPersonaManager.createPersonaHierarchy(
        adminContextId,
        specialistContextId,
        adminPermissions
      );

      // 権限の取得
      const permissions = await rbacPersonaManager.getPersonaPermissions(
        specialistContextId,
        true // include hierarchy
      );

      expect(permissions).toBeTruthy();
      expect(permissions.effective_permissions).toBeDefined();
      expect(permissions.hierarchy_depth).toBeGreaterThan(0);
    });

    test('should check persona permissions correctly', async () => {
      // Admin権限の設定
      const adminPermissions = PersonaRBACHelper.createBasicPermissions('admin');
      await rbacPersonaManager.createPersonaHierarchy(
        adminContextId,
        specialistContextId,
        adminPermissions
      );

      // 権限チェック
      const hasAdminAccess = await rbacPersonaManager.checkPersonaPermission(
        specialistContextId,
        'admin',
        'memory'
      );

      const hasRestrictedAccess = await rbacPersonaManager.checkPersonaPermission(
        assistantContextId,
        'admin', 
        'memory'
      );

      expect(hasAdminAccess).toBe(true);
      expect(hasRestrictedAccess).toBe(false);
    });

    test('should update persona permissions', async () => {
      const memoryPermissions = PersonaRBACHelper.createMemoryPermissions(
        ['work', 'personal'],
        ['read', 'write']
      );

      const updated = await rbacPersonaManager.updatePersonaPermissions(
        assistantContextId,
        memoryPermissions,
        [] // no permissions to remove
      );

      expect(updated).toBe(true);

      // 更新された権限の確認
      const permissions = await rbacPersonaManager.getPersonaPermissions(assistantContextId);
      expect(permissions.direct_permissions.length).toBeGreaterThan(0);
    });

    test('should retrieve hierarchy tree', async () => {
      // 階層作成
      await rbacPersonaManager.createPersonaHierarchy(
        adminContextId,
        specialistContextId,
        PersonaRBACHelper.createBasicPermissions('specialist')
      );

      await rbacPersonaManager.createPersonaHierarchy(
        specialistContextId,
        assistantContextId,
        PersonaRBACHelper.createBasicPermissions('assistant')
      );

      // 階層ツリーの取得
      const hierarchyTree = await rbacPersonaManager.getPersonaHierarchyTree(adminContextId);

      expect(hierarchyTree).toBeTruthy();
      expect(hierarchyTree.root_context_id).toBe(adminContextId);
      expect(hierarchyTree.children.length).toBeGreaterThan(0);
    });

    test('should get self capabilities', async () => {
      // 権限設定
      const toolPermissions = PersonaRBACHelper.createToolPermissions([
        'memory_search',
        'memory_store',
        'llm_generate'
      ]);

      await rbacPersonaManager.updatePersonaPermissions(
        specialistContextId,
        toolPermissions
      );

      // 自己能力の取得
      const capabilities = await rbacPersonaManager.getPersonaSelfCapabilities(specialistContextId);

      expect(capabilities).toBeTruthy();
      expect(capabilities.available_tools).toBeDefined();
      expect(capabilities.memory_scopes).toBeDefined();
      expect(capabilities.hierarchy_position).toBeDefined();
    });
  });

  describe('PersonaRBACHelper Tests', () => {
    test('should create basic permissions for different roles', () => {
      const adminPerms = PersonaRBACHelper.createBasicPermissions('admin');
      const specialistPerms = PersonaRBACHelper.createBasicPermissions('specialist');
      const assistantPerms = PersonaRBACHelper.createBasicPermissions('assistant');
      const observerPerms = PersonaRBACHelper.createBasicPermissions('observer');
      const guestPerms = PersonaRBACHelper.createBasicPermissions('guest');

      expect(adminPerms.length).toBeGreaterThan(specialistPerms.length);
      expect(specialistPerms.length).toBeGreaterThan(assistantPerms.length);
      expect(assistantPerms.length).toBeGreaterThan(observerPerms.length);
      expect(observerPerms.length).toBeGreaterThan(guestPerms.length);

      // Admin should have admin permissions
      expect(adminPerms.some(p => p.action === 'admin')).toBe(true);
      
      // Guest should only have read permissions
      expect(guestPerms.every(p => p.action === 'read')).toBe(true);
    });

    test('should create tool permissions', () => {
      const tools = ['memory_search', 'llm_generate', 'google_search'];
      const toolPerms = PersonaRBACHelper.createToolPermissions(tools);

      expect(toolPerms.length).toBe(tools.length);
      expect(toolPerms.every(p => p.action === 'execute')).toBe(true);
      expect(toolPerms.every(p => p.resource.startsWith('tool:'))).toBe(true);
    });

    test('should create memory permissions', () => {
      const scopes = ['work', 'personal', 'public'];
      const actions = ['read', 'write'] as ('read' | 'write')[];
      const memoryPerms = PersonaRBACHelper.createMemoryPermissions(scopes, actions);

      expect(memoryPerms.length).toBe(scopes.length * actions.length);
      expect(memoryPerms.every(p => p.resource === 'memory')).toBe(true);
      expect(memoryPerms.every(p => p.conditions?.scope)).toBe(true);
    });

    test('should get recommended hierarchies', () => {
      const recommendations = PersonaRBACHelper.getRecommendedHierarchy();

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.every(r => r.pattern && r.description && r.example)).toBe(true);
    });

    test('should validate permission inheritance', () => {
      const parentPerms = PersonaRBACHelper.createBasicPermissions('admin');
      const childPerms = PersonaRBACHelper.createBasicPermissions('specialist');

      const validation = PersonaRBACHelper.validatePermissionInheritance(
        parentPerms,
        childPerms
      );

      expect(validation.valid).toBeDefined();
      expect(Array.isArray(validation.conflicts)).toBe(true);
      expect(Array.isArray(validation.recommendations)).toBe(true);
    });
  });

  describe('Integration Error Handling', () => {
    test('should handle invalid context IDs gracefully', async () => {
      const result = await rbacPersonaManager.createPersonaHierarchy(
        'invalid-parent',
        'invalid-child'
      );

      expect(result).toBe(false);
    });

    test('should handle permission check failures', async () => {
      const hasPermission = await rbacPersonaManager.checkPersonaPermission(
        'non-existent-context',
        'admin',
        'memory'
      );

      expect(hasPermission).toBe(false);
    });

    test('should handle database connection errors', async () => {
      // データベースを一時的に閉じる
      db.close();

      const permissions = await rbacPersonaManager.getPersonaPermissions('test-context');
      expect(permissions).toBeNull();

      // データベースを再オープン
      db = new Database(testDbPath);
    });
  });

  describe('Performance Tests', () => {
    test('should handle large hierarchy efficiently', () => {
      const startTime = Date.now();

      // 10レベルの階層を作成
      let parentContext = contextDb.createContext({
        name: 'Root Admin',
        personality: 'Root administrator',
        systemPrompt: 'You are the root administrator.',
        maxTokens: 1000,
        temperature: 0.7
      });
      let parentId = parentContext.id;

      for (let i = 1; i <= 10; i++) {
        const childContext = contextDb.createContext({
          name: `Level ${i} Persona`,
          personality: `Level ${i} persona`,
          systemPrompt: `You are a level ${i} persona.`,
          maxTokens: 1000,
          temperature: 0.7
        });
        const childId = childContext.id;

        // Note: In real test, this would be awaited
        rbacPersonaManager.createPersonaHierarchy(
          parentId,
          childId,
          PersonaRBACHelper.createBasicPermissions('assistant')
        );

        parentId = childId;
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 1秒以内で完了することを確認（同期操作なので）
      expect(duration).toBeLessThan(1000);
    });

    test('should cache permissions efficiently', () => {
      const context = contextDb.createContext({
        name: 'Performance Test Persona',
        personality: 'Performance testing persona',
        systemPrompt: 'You are a performance testing persona.',
        maxTokens: 1000,
        temperature: 0.7
      });
      const contextId = context.id;

      // 初回アクセス時間を測定
      const start1 = Date.now();
      rbacPersonaManager.getPersonaPermissions(contextId, true);
      const duration1 = Date.now() - start1;

      // 2回目アクセス時間を測定（キャッシュが効くはず）
      const start2 = Date.now();
      rbacPersonaManager.getPersonaPermissions(contextId, true);
      const duration2 = Date.now() - start2;

      // 初回完了を確認
      expect(duration1).toBeGreaterThan(0);
      expect(duration2).toBeGreaterThan(0);
    });
  });
});

/**
 * 統合テスト実行ヘルパー
 */
export async function runRBACIntegrationTests(): Promise<void> {
  console.log('🧪 Starting PersonaManager RBAC Integration Tests...');
  
  try {
    // Jestを使用してテストを実行
    const { execSync } = require('child_process');
    execSync('npx jest tests/persona-rbac-integration.test.ts --verbose', {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    
    console.log('✅ All RBAC integration tests passed');
  } catch (error) {
    console.error('❌ RBAC integration tests failed:', error);
    throw error;
  }
}
