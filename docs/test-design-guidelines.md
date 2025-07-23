# テスト設計ガイドライン

## 目的
Sprint4 Phase 1でのテスト品質問題を踏まえ、高品質で保守性の高いテストコードを作成するためのガイドラインです。

## 基本原則

### 1. テスト独立性の確保
- **各テストは完全に独立** して実行可能でなければならない
- テスト実行順序に依存してはならない
- 他のテストの実行結果に影響されてはならない

### 2. 一意性の担保
- **context_id は必ず一意** にする
- テスト名やテストケースの内容を反映した意味のあるIDを使用
- 例: `smart_delegator`, `monitor_delegatee`, `security_test_001`

### 3. 完全セットアップ
- データベース状態を **完全に初期化** してからテスト実行
- 必要なデータは **すべて明示的に作成**
- 外部キー制約を考慮した順序でデータ作成

## データベーステストのベストプラクティス

### セットアップパターン

```typescript
// ✅ 良い例: 完全セットアップ
test('タスク委譲システムテスト', () => {
  // 1. 一意IDでコンテキスト作成
  const delegatorId = 'task_test_delegator_001';
  const delegateeId = 'task_test_delegatee_001';
  
  // 2. contextsテーブルに基本情報作成
  db.prepare('INSERT INTO contexts (context_id, name) VALUES (?, ?)').run(delegatorId, 'Test Delegator');
  db.prepare('INSERT INTO contexts (context_id, name) VALUES (?, ?)').run(delegateeId, 'Test Delegatee');
  
  // 3. persona_capabilitiesテーブルに能力情報設定（重要！）
  personaManager.updatePersonaCapabilities(delegatorId, {
    expertise: ['management'],
    tools: ['delegation'],
    restrictions: []
  });
  
  personaManager.updatePersonaCapabilities(delegateeId, {
    expertise: ['python', 'development'],
    tools: ['coding', 'testing'],
    restrictions: []
  });
  
  // 4. テスト実行
  const result = personaManager.createTaskDelegation({
    from_context_id: delegatorId,
    to_context_id: delegateeId,
    // ... その他のパラメータ
  });
  
  // 5. アサーション
  expect(result).toBeTruthy();
});
```

### 避けるべきパターン

```typescript
// ❌ 悪い例: 不完全セットアップ
test('悪いテスト例', () => {
  // contexts のみ作成（persona_capabilities 未作成）
  db.prepare('INSERT INTO contexts (context_id, name) VALUES (?, ?)').run('delegator', 'Delegator');
  
  // createTaskDelegation は persona_capabilities をチェックするので失敗する
  const result = personaManager.createTaskDelegation({
    from_context_id: 'delegator', // ← from_exists: false エラーが発生
    to_context_id: 'delegatee',
    // ...
  });
});

// ❌ 悪い例: ID重複
test('テスト1', () => {
  db.prepare('INSERT INTO contexts (context_id, name) VALUES (?, ?)').run('delegator', 'Delegator');
  // ...
});

test('テスト2', () => {
  db.prepare('INSERT INTO contexts (context_id, name) VALUES (?, ?)').run('delegator', 'Delegator'); // ← UNIQUE制約エラー
  // ...
});
```

## ID命名規則

### 推奨パターン

1. **機能別プレフィックス**
   - タスク委譲: `task_` (例: `task_delegator_001`)
   - スマート委譲: `smart_` (例: `smart_candidate_ml`)
   - セキュリティ: `security_` (例: `security_admin_test`)
   - 監視: `monitor_` (例: `monitor_observer_001`)

2. **テスト種別サフィックス**
   - 正常系: `_ok`, `_success` (例: `task_delegator_ok`)
   - 異常系: `_error`, `_fail` (例: `task_invalid_fail`)
   - 境界値: `_boundary`, `_edge` (例: `task_max_boundary`)

3. **連番管理**
   - 同一機能で複数テスト: `_001`, `_002` (例: `task_delegator_001`, `task_delegator_002`)

### 例

```typescript
// 機能別ID例
const TASK_DELEGATION_IDS = {
  delegator: 'task_delegator_001',
  delegatee: 'task_delegatee_001',
  invalid_delegator: 'task_invalid_delegator_error',
  boundary_delegator: 'task_boundary_delegator_edge'
};

const SMART_DELEGATION_IDS = {
  requester: 'smart_requester_001',
  ml_candidate: 'smart_candidate_ml_expert',
  web_candidate: 'smart_candidate_web_expert'
};
```

## エラーハンドリングテスト

### 必須テストケース

1. **外部キー制約違反**
```typescript
test('外部キー制約エラーのハンドリング', () => {
  // 意図的に persona_capabilities を未設定
  const result = personaManager.createTaskDelegation({
    from_context_id: 'nonexistent_context',
    to_context_id: 'also_nonexistent',
    // ...
  });
  
  // null が返されることを確認
  expect(result).toBeNull();
});
```

2. **UNIQUE制約違反**
3. **データ型不一致**
4. **必須項目未設定**

## テストレビューチェックリスト

### セットアップ確認
- [ ] 一意のcontext_IDを使用している
- [ ] contextsテーブルとpersona_capabilitiesテーブル両方を設定している
- [ ] 外部キー制約を考慮した順序でデータ作成している
- [ ] テスト用データが他のテストと重複していない

### テストロジック確認
- [ ] 正常系・異常系・境界値をカバーしている
- [ ] アサーションが適切で十分である
- [ ] エラーハンドリングのテストが含まれている
- [ ] テストの意図がコメントで明確になっている

### 保守性確認
- [ ] テスト名が内容を適切に表現している
- [ ] ハードコード値を避け、定数や変数を使用している
- [ ] テストコードが読みやすく理解しやすい
- [ ] テストデータの準備とクリーンアップが適切

## デバッグ支援

### ログ出力の活用
```typescript
test('デバッグ支援付きテスト', () => {
  const delegatorId = 'debug_delegator_001';
  
  // セットアップ状況をログ出力
  console.log(`Setting up test with delegator: ${delegatorId}`);
  
  // データ作成後に存在確認
  const exists = db.prepare('SELECT 1 FROM persona_capabilities WHERE context_id = ?').get(delegatorId);
  console.log(`Delegator exists in persona_capabilities: ${!!exists}`);
  
  // テスト実行
  const result = personaManager.createTaskDelegation({...});
  console.log(`Delegation result: ${result}`);
  
  expect(result).toBeTruthy();
});
```

### エラー情報の活用
- PersonaManagerのエラーログ（console.error）を確認
- 外部キー制約エラー時は from_exists/to_exists の値を確認
- SQLite エラーメッセージの詳細を確認

## 更新履歴

- 2025-07-20: 初版作成（Sprint4 Phase 1の品質問題を受けて策定）
