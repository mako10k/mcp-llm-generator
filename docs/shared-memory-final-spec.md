# Sprint4.5 共有メモリMCPツール最終仕様書

**作成日**: 2025-07-19  
**レビュアー**: Sprint5 AI研究者、システムアーキテクト  
**承認**: 専門家レビュー完了

## 🎯 専門家レビューサマリー

### AI研究者の評価
✅ **アーキテクチャの妥当性**: 主体LLMと人格LLMの分離は理想的  
⚠️ **技術課題**: キャッシュ層、状態同期、セキュリティ設計が必要  
📋 **実装優先順位**: 認知系 → 全体把握 → 協調系

### システムアーキテクトの評価  
✅ **技術選択**: TypeScript + Node.jsは適切  
⚠️ **構造的問題**: SQLite限界、キャッシュ欠如、RBAC未設計  
🏗️ **設計パターン**: Adapter/Facade、CQRS、イベント駆動を推奨

---

## 📋 最終MCPツール仕様

### 1. `queryPersonaCapabilities` [Phase 1]
**主体**: 主体LLM  
**目的**: タスクに適した人格を発見

```typescript
interface QueryPersonaCapabilitiesRequest {
  task_description: string;          // "React コンポーネント最適化"
  required_skills: string[];         // ["react", "performance"]
  return_top_n?: number;            // デフォルト: 3
  exclude_context_ids?: string[];   // 除外する人格ID
  include_availability?: boolean;    // 可用性情報を含める
}

interface QueryPersonaCapabilitiesResponse {
  success: true;
  suitable_personas: Array<{
    context_id: string;
    name: string;
    match_score: number;            // 0-100の適合度
    expertise: string[];
    current_availability: "available" | "busy" | "offline";
    estimated_response_time?: string;
  }>;
  recommendation: string;           // AIによる推奨メッセージ
  search_metadata: {
    total_searched: number;
    search_time_ms: number;
  };
}
```

### 2. `getPersonaProfile` [Phase 1]
**主体**: 主体LLM、人格LLM  
**目的**: 自己/他者の能力情報取得

```typescript
interface GetPersonaProfileRequest {
  context_id: "self" | string;      // "self"は現在の人格
  detail_level?: "basic" | "detailed" | "full";
  requester_context_id?: string;    // 権限チェック用
  include_performance?: boolean;     // パフォーマンス履歴
  include_lineage?: boolean;        // 系譜情報
}

interface GetPersonaProfileResponse {
  success: true;
  context_id: string;
  name: string;
  capabilities: {
    public_expertise: string[];     // 公開スキル
    public_tools: string[];         // 公開ツール
    collaboration_score: number;    // 協力しやすさ 0-100
    communication_style: "technical" | "casual" | "formal";
    preferred_tasks: string[];      // 得意タスク
  };
  availability: {
    status: "available" | "busy" | "offline";
    current_load: number;           // 現在のタスク数
    estimated_response_time: string;
  };
  access_level: "public" | "limited" | "full"; // 権限レベル
  restricted_info?: {
    hidden_capabilities_count: number;
    access_reason: string;
  };
}
```

### 3. `getAllPersonasSummary` [Phase 1]  
**主体**: 主体LLM  
**目的**: システム全体の人格概要把握

```typescript
interface GetAllPersonasSummaryRequest {
  include_availability?: boolean;    // デフォルト: true
  group_by?: "expertise_area" | "role" | "availability";
  filter_by_status?: "available" | "busy" | "all";
}

interface GetAllPersonasSummaryResponse {
  success: true;
  persona_groups: Record<string, Array<{
    context_id: string;
    name: string;
    primary_expertise: string[];
    status: "available" | "busy" | "offline";
    current_load: number;
  }>>;
  system_summary: {
    total_personas: number;
    available_count: number;
    busy_count: number;
    offline_count: number;
  };
  recommended_workflow: string;      // AIによる推奨ワークフロー
}
```

### 4. `requestCollaboration` [Phase 2]
**主体**: 人格LLM  
**目的**: 他人格への協力要請

```typescript
interface RequestCollaborationRequest {
  target_context_id: string;
  request_type: "consultation" | "task_delegation" | "knowledge_sharing";
  task_description: string;
  urgency: "low" | "medium" | "high" | "urgent";
  expected_effort?: string;          // "30分程度の確認"
  deadline?: string;                 // ISO 8601形式
  context_info?: string;            // 追加のコンテキスト情報
}

interface RequestCollaborationResponse {
  success: true;
  collaboration_id: string;
  target_persona: {
    name: string;
    estimated_response_time: string;
    collaboration_preference: string;
  };
  status: "sent" | "accepted" | "declined" | "pending";
  message?: string;                 // 相手からのメッセージ
  next_steps: string[];
}
```

---

## 🏗️ システムアーキテクチャ設計

### Phase 1 アーキテクチャ (基盤整備)
```
[主体LLM] → [MCPクライアント] → [MCPツールAdapter] → [PersonaManager] → [SQLite + Redis]
                                         ↓
[人格LLM] ← [MCPサンプリング] ← [RBACミドルウェア] ← [PersonaManager] ← [キャッシュ層]
```

### 技術スタック
- **Core**: TypeScript + Node.js
- **Database**: SQLite (Phase 1) → PostgreSQL (Phase 3)
- **Cache**: Redis (Phase 1導入)
- **Security**: RBAC + JWT + 監査ログ
- **Pattern**: Adapter/Facade + CQRS

### キャッシュ戦略
```typescript
// Redis キャッシュキー設計
persona:profile:{context_id}        // 人格プロフィール
persona:capabilities:{context_id}   // 能力情報
persona:availability:{context_id}   // 可用性状態
system:summary                      // システム概要
collaboration:active                // アクティブな協力要請
```

---

## 🔒 セキュリティ設計

### RBAC権限レベル
```typescript
enum PersonaRole {
  ADMIN = "admin",           // 全アクセス + 人格管理
  SPECIALIST = "specialist", // 専門分野 + 制限付き協力
  OBSERVER = "observer",     // 読み取り専用
  GUEST = "guest"           // 最小限アクセス
}

enum Permission {
  READ_OWN_PROFILE = "read_own_profile",
  READ_PUBLIC_PROFILES = "read_public_profiles", 
  READ_DETAILED_PROFILES = "read_detailed_profiles",
  CREATE_COLLABORATION = "create_collaboration",
  MANAGE_PERSONAS = "manage_personas",
  VIEW_SYSTEM_SUMMARY = "view_system_summary"
}
```

### 監査ログ
```typescript
interface AuditLog {
  timestamp: string;
  action: string;              // "queryPersonaCapabilities"
  actor_context_id: string;    // 実行者
  target_context_id?: string;  // 対象人格
  success: boolean;
  metadata: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
}
```

---

## 📈 実装フェーズ詳細

### Phase 1: 基盤整備 (2週間)
**目標**: 基本的な人格検索・認識機能の実装

**作業項目**:
- [ ] MCPツールAdapter実装 (`queryPersonaCapabilities`, `getPersonaProfile`, `getAllPersonasSummary`)
- [ ] Redis導入・キャッシュ層実装
- [ ] RBACミドルウェア基本実装
- [ ] 監査ログシステム基本実装
- [ ] 既存PersonaManagerとの統合テスト

**成果物**:
- 3つの基本MCPツールが動作
- キャッシュ機能付きの人格検索
- 基本的な権限管理

### Phase 2: 協力システム (1週間)
**目標**: 人格間協力機能の実装

**作業項目**:
- [ ] `requestCollaboration` MCPツール実装
- [ ] 協力要請の状態管理システム
- [ ] 通知・メッセージングシステム基本実装
- [ ] 協力履歴の記録・追跡機能

**成果物**:
- 人格間での協力要請・応答システム
- 協力履歴の可視化

### Phase 3: スケーラビリティ強化 (将来)
**目標**: エンタープライズレベル対応

**作業項目**:
- PostgreSQL移行
- マイクロサービス化
- API Gateway導入
- 高度な監視・アラート

---

## 🧪 テスト戦略

### 単体テスト
- 各MCPツールの正常系・異常系
- PersonaManagerとAdapterの結合テスト
- RBACミドルウェアの権限チェック
- キャッシュ機能の動作確認

### 統合テスト
- 主体LLM ↔ MCPツール ↔ PersonaManager の完全フロー
- 複数人格LLMの同時アクセステスト
- キャッシュ整合性テスト
- セキュリティ侵入テスト

### 実用テスト
- 実際の開発タスクでの人格選択精度
- 協力要請フローの使用感テスト
- パフォーマンス・負荷テスト

---

## ✅ Phase 1 開始条件

1. **プリセットパーソナリティバグ修正完了**
2. **Redis環境構築完了** 
3. **RBACミドルウェア基本設計完了**
4. **テスト環境準備完了**

---

**この最終仕様書に基づいて、専門家の助言を反映した堅牢な共有メモリシステムを構築します。**

Phase 1から段階的に実装し、技術的負債を避けながら拡張可能なアーキテクチャを実現しましょう！
