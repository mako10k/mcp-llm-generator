# Product Backlog - MCP LLM Generator

最終更新: 2025-07-19

## 🚨 緊急修正が必要な既知のバグ

### Bug #1: プリセットパーソナリティ参照エラー
- **現象**: `create_from_preset` 実行時に "Unknown personality preset" エラーが発生
- **再現手順**: 
  1. `personality-preset-manage` で新しいプリセットを作成
  2. 作成されたプリセットIDを使用して `context-manage` で `create_from_preset` を実行
  3. エラーが発生
- **影響度**: 高（プリセット機能が使用不可）
- **推定原因**: プリセットの保存・参照システムの不整合
- **優先度**: P0 (即座に修正)

## 📋 Sprint4 未完了機能

### Sprint4 Phase 1 機能格差

#### 1. 共有メモリ・ペルソナ検索システム (未実装)
**要求仕様**:
- 各ペルソナが自身と他ペルソナの能力を認識する機能
- ペルソナ能力検索・参照API
- タスク委譲・協力システム

**実装状況**:
- ✅ データベーススキーマ: `persona_capabilities`, `persona_roles`, `persona_lineage`, `task_delegations` テーブル作成済み
- ✅ 基本API: `PersonaManager` クラスで `getPersonaCapabilities`, `updatePersonaCapabilities` 実装済み
- ❌ **未実装**:
  - ペルソナ能力検索用のMCPツール (例: `queryPersonas`, `getPersonaDirectory`)
  - 自覚・他覚機能のMCPツール (例: `getMyCapabilities`, `getOtherCapabilities`)
  - タスク委譲のMCPツール (例: `delegateTask`, `acceptTask`)
  - ペルソナ能力の自動発見・更新機能

#### 2. 人格能力システムの統合 (部分実装)
**要求仕様**:
- 自覚・他覚機能：各人格が自身と他人格の能力を認識
- 能力検索・参照API
- タスク委譲・協力システム

**実装状況**:
- ✅ PersonaManager クラスに `findSuitablePersona` メソッド実装済み
- ✅ `createTaskDelegation` メソッド実装済み
- ❌ **未実装**:
  - MCPツールとしてのエクスポート
  - フロントエンド（VS Code等）からの呼び出し可能な形式
  - 実用的なテスト環境

#### 3. 人格作成防止・権限管理システム (部分実装)
**要求仕様**:
- 人格作成権限の制御（管理者人格のみ）
- RBAC（Role-Based Access Control）システム
- 人格生成履歴・親子関係管理

**実装状況**:
- ✅ データベーススキーマ: `persona_roles`, `persona_lineage` テーブル作成済み
- ✅ PersonaManager クラスに `checkRolePermissions` メソッド実装済み
- ❌ **未実装**:
  - コンテキスト作成時の権限チェック統合
  - 管理者権限の初期設定・管理機能
  - 人格作成時の親子関係自動記録

#### 4. システムプロンプト最適化 (部分実装)
**要求仕様**:
- 能力情報のプロンプト注入によるトークン数圧迫対策
- AI要約技術で能力情報を省略化
- タスク内容に応じた必要能力のみ選択注入

**実装状況**:
- ✅ PromptTokenManager, PromptSecurityManager クラス実装済み
- ✅ PersonaManager に `optimizePromptForPersona` メソッド実装済み
- ❌ **未実装**:
  - 実際のコンテキスト作成・チャット時の自動適用
  - 能力情報の要約機能の統合
  - トークン制限の動的調整

## 🎯 Sprint5 計画への影響

### Sprint5で予定していた機能
1. **マルチモーダルAI統合** - テキスト、画像、音声の統合処理
2. **AIアナリティクス** - 使用パターン分析とパフォーマンス最適化  
3. **ニューラルコンテキストネットワーク** - 動的学習と適応的応答
4. **AIゲートウェイ** - 統一API、負荷分散、ルーティング

### 推奨対応戦略

#### オプション A: Sprint4未完了機能を先に完了
**メリット**:
- 基盤機能が完成してからSprint5に進める
- 共有メモリシステムがSprint5の協調AI機能の土台となる
- 技術的負債を残さない

**デメリット**:
- Sprint5開始が遅延
- すでに計画された機能の開発が後倒し

#### オプション B: Sprint5と並行して修正
**メリット**:
- Sprint5の新機能開発を予定通り開始
- 緊急性の高いバグ修正を優先

**デメリット**:
- 複数スプリントの並行作業で複雑化
- 基盤機能不完全なままの新機能開発

## 📊 推奨アクション

### 即座に対応 (P0)
1. **プリセットパーソナリティバグの修正**
   - プリセット保存・参照システムのデバッグ
   - ユニットテストの追加

### Sprint4.5 として短期修正 (P1)
2. **共有メモリMCPツールの実装**
   - `queryPersonas` - ペルソナ能力検索
   - `getMyCapabilities` - 自己能力参照
   - `delegateTask` - タスク委譲
   
3. **権限管理システムの統合**
   - コンテキスト作成時の権限チェック
   - 管理者権限の設定機能

### Sprint5に統合 (P2)
4. **システムプロンプト最適化の完成**
   - 既存実装のコンテキスト・チャット機能への統合
   - 能力情報要約機能の完成

## 🔄 次のアクション

1. **即座**: プリセットパーソナリティバグの調査・修正
2. **24時間以内**: 共有メモリMCPツールの実装計画作成
3. **48時間以内**: Sprint4.5として短期修正版の実装開始
4. **1週間以内**: Sprint5計画の調整・更新

---

**作成者**: GitHub Copilot  
**プロジェクト**: MCP LLM Generator  
**スプリント**: Sprint4-5 移行期
