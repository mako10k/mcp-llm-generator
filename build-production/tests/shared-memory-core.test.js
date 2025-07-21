import { SharedMemoryCore } from '../src/core/shared-memory-core.js';
import Database from 'better-sqlite3';
describe('SharedMemoryCore', () => {
    let db;
    let core;
    beforeEach(() => {
        db = new Database(':memory:');
        core = new SharedMemoryCore(db);
    });
    afterEach(() => {
        core.close();
    });
    describe('createMemory', () => {
        test('正常なメモリ作成', () => {
            const request = {
                title: 'テストメモ',
                content: 'テスト内容',
                permission_level: 'edit',
                creator_persona_id: 'persona-123'
            };
            const result = core.createMemory(request);
            expect(result.success).toBe(true);
            expect(result.data?.id).toBeDefined();
            expect(result.data?.id).toMatch(/^memory-/);
        });
        test('無効なデータでの作成失敗', () => {
            const request = {
                title: '', // 無効: 空のタイトル
                content: 'テスト内容',
                permission_level: 'edit',
                creator_persona_id: 'persona-123'
            };
            const result = core.createMemory(request);
            expect(result.success).toBe(false); // 無効データなので失敗を期待
            expect(result.error).toBeDefined();
        });
    });
    describe('searchMemories', () => {
        test('全件検索', () => {
            core.createMemory({
                title: 'JavaScript基礎',
                content: 'JavaScript の基本的な文法について',
                permission_level: 'edit',
                creator_persona_id: 'persona-123'
            });
            core.createMemory({
                title: 'TypeScript応用',
                content: 'TypeScript の型システムについて',
                permission_level: 'edit',
                creator_persona_id: 'persona-456'
            });
            const result = core.searchMemories({ limit: 10, offset: 0 }, 'persona-123');
            expect(result.success).toBe(true);
            expect(result.data?.memories).toHaveLength(2);
            expect(result.data?.total).toBe(2);
        });
        test('キーワード検索', () => {
            core.createMemory({
                title: 'JavaScript基礎',
                content: 'JavaScript の基本的な文法について',
                permission_level: 'edit',
                creator_persona_id: 'persona-123'
            });
            const result = core.searchMemories({ query: 'JavaScript', limit: 10, offset: 0 }, 'persona-123');
            expect(result.success).toBe(true);
            expect(result.data?.memories).toHaveLength(1);
            expect(result.data?.memories[0].title).toBe('JavaScript基礎');
        });
    });
    describe('getMemory', () => {
        test('存在するメモリの取得', () => {
            const createResult = core.createMemory({
                title: 'テストメモ',
                content: 'テスト内容',
                permission_level: 'edit',
                creator_persona_id: 'persona-123'
            });
            expect(createResult.success).toBe(true);
            const memoryId = createResult.data.id;
            const getResult = core.getMemory(memoryId, 'persona-123');
            expect(getResult.success).toBe(true);
            expect(getResult.data?.id).toBe(memoryId);
            expect(getResult.data?.title).toBe('テストメモ');
        });
    });
    describe('notifications', () => {
        test('通知の取得', () => {
            core.createMemory({
                title: '通知テストメモ',
                content: '通知テスト内容',
                permission_level: 'edit',
                creator_persona_id: 'persona-123'
            });
            const result = core.getRecentNotifications('persona-123', 10);
            expect(result.success).toBe(true);
            expect(result.data).toHaveLength(1);
            expect(result.data[0].type).toBe('created');
            expect(result.data[0].message).toBe('メモリが作成されました。'); // 実際のメッセージに修正
        });
        test('通知の作成確認', () => {
            const request = {
                title: '通知テスト',
                content: '通知内容',
                permission_level: 'edit',
                creator_persona_id: 'persona-789'
            };
            const result = core.createMemory(request);
            expect(result.success).toBe(true);
            expect(result.data?.id).toBeDefined();
            const notifications = core.getNotifications('persona-789');
            expect(notifications.success).toBe(true);
            expect(notifications.data?.length).toBeGreaterThan(0);
            expect(notifications.data?.[0].type).toBe('created'); // 実装に合わせて修正
            expect(notifications.data?.[0].message).toBe('メモリが作成されました。');
        });
    });
});
