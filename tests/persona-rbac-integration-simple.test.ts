/**
 * Phase 2: PersonaManager RBAC統合テストスイート（簡易版）
 * RBAC機能の基本テスト
 */

import { createRBACPersonaManager, PersonaRBACHelper, validateRBACIntegration } from '../src/rbac/PersonaRBACIntegration.js';
import { PersonaManager } from '../src/utils/personaManager.js';
import { RBACEngine } from '../src/rbac/RBACEngine.js';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

describe('PersonaManager RBAC Integration Tests', () => {
  let testDbPath: string;
  let personaManager: PersonaManager;
  let rbacPersonaManager: any;
  let db: Database.Database;

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
    test('should create persona hierarchy successfully', async () => {
      // テスト用のコンテキストIDを手動で挿入
      const adminContextId = 'test-admin-context';
      const specialistContextId = 'test-specialist-context';
      
      // DBに直接コンテキストを挿入
      db.prepare(`
        INSERT INTO persona_context (id, name, personality, system_prompt)
        VALUES (?, ?, ?, ?)
      `).run(adminContextId, 'Admin Persona', 'System administrator', 'You are an admin');
      
      db.prepare(`
        INSERT INTO persona_context (id, name, personality, system_prompt)
        VALUES (?, ?, ?, ?)
      `).run(specialistContextId, 'Specialist Persona', 'Data specialist', 'You are a specialist');

      const adminPermissions = PersonaRBACHelper.createBasicPermissions('admin');
      const specialistPermissions = PersonaRBACHelper.createBasicPermissions('specialist');

      // Admin -> Specialist hierarchy
      const hierarchyCreated = await rbacPersonaManager.createPersonaHierarchy(
        adminContextId,
        specialistContextId,
        specialistPermissions
      );

      expect(hierarchyCreated).toBe(true);
    });

    test('should retrieve persona permissions with hierarchy', async () => {
      const contextId = 'test-permission-context';
      
      // DBに直接コンテキストを挿入
      db.prepare(`
        INSERT INTO persona_context (id, name, personality, system_prompt)
        VALUES (?, ?, ?, ?)
      `).run(contextId, 'Permission Test', 'Permission testing persona', 'You are a test persona');

      // 権限の取得
      const permissions = await rbacPersonaManager.getPersonaPermissions(
        contextId,
        true // include hierarchy
      );

      expect(permissions).toBeTruthy();
    });

    test('should check persona permissions correctly', async () => {
      const contextId = 'test-check-context';
      
      // DBに直接コンテキストを挿入
      db.prepare(`
        INSERT INTO persona_context (id, name, personality, system_prompt)
        VALUES (?, ?, ?, ?)
      `).run(contextId, 'Check Test', 'Permission check persona', 'You are a check test persona');

      // 権限チェック
      const hasPermission = await rbacPersonaManager.checkPersonaPermission(
        contextId,
        'read',
        'memory'
      );

      expect(typeof hasPermission).toBe('boolean');
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
    execSync('npx jest tests/persona-rbac-integration-simple.test.ts --verbose', {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    
    console.log('✅ All RBAC integration tests passed');
  } catch (error) {
    console.error('❌ RBAC integration tests failed:', error);
    throw error;
  }
}
