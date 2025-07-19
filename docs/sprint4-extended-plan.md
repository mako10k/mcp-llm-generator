# Sprint4 拡張計画: AI Tool Integration Foundation + 人格能力システム 🧠⚡

> **目標**: AIツール統合基盤の構築 + 人格能力の自覚・他覚システムの実装

## 📋 Sprint4 拡張要件 Overview

### 【既存Sprint4要件】
- **AI Tool Calling**: Sampler + External Provider Integration  
- **Shared Memory System**: 人格間メモリ共有
- **Security Controls**: アクセス制御、監査ログ

### 【追加要件1: 人格能力システム】  
- **自覚・他覚機能**: 各人格が自身と他人格の能力（ツール、専門分野、制限）を認識
- **能力検索・参照API**: 人格能力の発見・参照システム
- **タスク委譲・協力**: 能力ベースでのタスク委譲システム

### 【追加要件2: 人格作成防止策】（次スプリント検討）
- **作成権限制御**: 人格管理者人格のみ作成可能
- **RBAC**: Role-Based Access Control システム
- **生成履歴管理**: 人格の親子関係・生成履歴管理

---

## 🏗️ システムアーキテクチャ（拡張版）

```plaintext
┌─────────────────────────────────────────────────────────────────────┐
│                      MCP LLM Generator v2.1                        │
│                     AI Tool Integration Foundation                  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
    ┌───v───┐                   ┌───v───┐                   ┌───v───┐
    │ Tool  │                   │Shared │                   │Persona│
    │Calling│◄──────────────────►│Memory │◄──────────────────►│Mgmt  │
    │System │                   │System │                   │System │
    └───┬───┘                   └───┬───┘                   └───┬───┘
        │                           │                           │
    ┌───v───┐                   ┌───v───┐                   ┌───v───┐
    │Sampler│                   │SQLite │                   │RBAC  │
    │JSON   │                   │+ Cache│                   │Auth  │
    │Parser │                   │Layer  │                   │Audit │
    └───┬───┘                   └───┬───┘                   └───┬───┘
        │                           │                           │
    ┌───v───┐                   ┌───v───┐                   ┌───v───┐
    │OpenAI │                   │Memory │                   │Persona│
    │Claude │                   │Access │                   │Cap.  │
    │APIs   │                   │Control│                   │Search│
    └───────┘                   └───────┘                   └───────┘
```

---

## 🗃️ データベース設計（拡張版）

### 【既存テーブル】
- `contexts` - 人格定義
- `conversations` - 会話履歴  
- `templates` - テンプレート管理

### 【新規テーブル】

#### `persona_capabilities` - 人格能力情報
```sql
CREATE TABLE persona_capabilities (
    id TEXT PRIMARY KEY,
    persona_id TEXT NOT NULL,
    tools JSON NOT NULL,           -- 利用可能ツール ["google-search", "web-fetch"]
    expertise JSON NOT NULL,       -- 専門分野 ["法律", "医療", "技術"]
    restrictions JSON NOT NULL,    -- 制限事項 ["外部API不可", "機密情報不可"]
    description TEXT,              -- 能力説明
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (persona_id) REFERENCES contexts(id)
);
```

#### `persona_roles` - 権限管理
```sql
CREATE TABLE persona_roles (
    id TEXT PRIMARY KEY,
    persona_id TEXT NOT NULL,
    role_name TEXT NOT NULL,       -- "admin", "user", "creator"
    permissions JSON NOT NULL,     -- ["create_persona", "edit_capabilities"]
    granted_by TEXT,               -- 付与者ID
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (persona_id) REFERENCES contexts(id)
);
```

#### `persona_lineage` - 生成履歴・親子関係
```sql
CREATE TABLE persona_lineage (
    id TEXT PRIMARY KEY,
    child_persona_id TEXT NOT NULL,
    parent_persona_id TEXT,        -- 作成者人格ID（NULL = システム作成）
    creation_reason TEXT,          -- 作成理由
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (child_persona_id) REFERENCES contexts(id),
    FOREIGN KEY (parent_persona_id) REFERENCES contexts(id)
);
```

#### `task_delegations` - タスク委譲履歴
```sql
CREATE TABLE task_delegations (
    id TEXT PRIMARY KEY,
    delegator_id TEXT NOT NULL,    -- 委譲元人格
    delegatee_id TEXT NOT NULL,    -- 委譲先人格
    task_description TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'completed', 'failed'
    result TEXT,                   -- 実行結果
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    FOREIGN KEY (delegator_id) REFERENCES contexts(id),
    FOREIGN KEY (delegatee_id) REFERENCES contexts(id)
);
```

---

## � システムプロンプト最適化戦略

### 【課題】
- 人格能力情報のプロンプト注入によるトークン数圧迫
- プロンプト肥大化によるコスト・パフォーマンス低下

### 【解決アプローチ】

#### 1. 能力情報の要約・圧縮
```typescript
interface CompressedCapabilities {
  expertise_tags: string[];      // ["法律", "技術"] (最大5個)
  tool_summary: string;         // "Web検索・API利用可" (20文字以内)
  key_restrictions: string[];   // ["外部API不可"] (最大3個)
}

function compressCapabilities(capabilities: PersonaCapabilities): CompressedCapabilities {
  return {
    expertise_tags: capabilities.expertise.slice(0, 5),
    tool_summary: summarizeTools(capabilities.tools),
    key_restrictions: capabilities.restrictions.slice(0, 3)
  };
}
```

#### 2. トークン数動的管理
```typescript
import { encoding_for_model } from 'tiktoken';

class PromptTokenManager {
  private maxTokens: number;
  private encoding = encoding_for_model('gpt-4');
  
  calculateTokens(text: string): number {
    return this.encoding.encode(text).length;
  }
  
  optimizePrompt(basePrompt: string, capabilities: CompressedCapabilities): string {
    let prompt = basePrompt;
    const capabilityText = this.formatCapabilities(capabilities);
    
    if (this.calculateTokens(prompt + capabilityText) > this.maxTokens) {
      // 能力情報を段階的に削減
      return this.reduceCapabilityInfo(prompt, capabilities);
    }
    
    return prompt + capabilityText;
  }
}
```

#### 3. タスク適応型能力選択
```typescript
function selectRelevantCapabilities(
  task: string, 
  allCapabilities: PersonaCapabilities
): CompressedCapabilities {
  const taskKeywords = extractKeywords(task);
  
  // タスクに関連する能力のみ抽出
  const relevantTools = allCapabilities.tools.filter(tool =>
    taskKeywords.some(keyword => tool.includes(keyword))
  );
  
  const relevantExpertise = allCapabilities.expertise.filter(exp =>
    taskKeywords.some(keyword => exp.includes(keyword))
  );
  
  return compressCapabilities({
    tools: relevantTools,
    expertise: relevantExpertise,
    restrictions: allCapabilities.restrictions
  });
}
```

---

## 🔄 人格統合・引継ぎシステム

### 【課題】
- 類似人格の重複による管理負荷
- 人格統合時の情報・権限の適切な引継ぎ

### 【解決アプローチ】

#### 1. 類似度分析・統合判定
```typescript
interface PersonaSimilarity {
  persona_id: string;
  similarity_score: number;
  merge_recommendation: 'auto' | 'manual' | 'reject';
}

class PersonaMergeAnalyzer {
  async analyzePersonaSimilarity(targetPersona: Persona): Promise<PersonaSimilarity[]> {
    const allPersonas = await this.getActivePersonas();
    const targetVector = await this.vectorizePersona(targetPersona);
    
    return allPersonas
      .filter(p => p.id !== targetPersona.id)
      .map(persona => ({
        persona_id: persona.id,
        similarity_score: this.cosineSimilarity(targetVector, this.vectorizePersona(persona)),
        merge_recommendation: this.getMergeRecommendation(similarity_score)
      }))
      .filter(result => result.similarity_score > 0.7) // 70%以上の類似度
      .sort((a, b) => b.similarity_score - a.similarity_score);
  }
  
  private vectorizePersona(persona: Persona): number[] {
    // 能力情報・専門分野・ツールをベクトル化
    const textData = [
      ...persona.capabilities.expertise,
      ...persona.capabilities.tools,
      persona.personality
    ].join(' ');
    
    return this.sentenceEmbedding(textData); // Sentence-BERT等使用
  }
}
```

#### 2. 統合時のデータマージ戦略
```typescript
interface MergeStrategy {
  capability_merge: 'union' | 'intersection' | 'manual';
  permission_merge: 'most_restrictive' | 'most_permissive' | 'manual';
  history_access: 'full' | 'summary' | 'restricted';
}

class PersonaMerger {
  async mergePersonas(
    primaryPersona: Persona, 
    secondaryPersonas: Persona[],
    strategy: MergeStrategy
  ): Promise<MergedPersona> {
    
    // 1. 能力情報の統合
    const mergedCapabilities = this.mergeCapabilities(
      primaryPersona.capabilities,
      secondaryPersonas.map(p => p.capabilities),
      strategy.capability_merge
    );
    
    // 2. 権限の統合（最小権限原則）
    const mergedPermissions = this.mergePermissions(
      primaryPersona.permissions,
      secondaryPersonas.map(p => p.permissions),
      strategy.permission_merge
    );
    
    // 3. 会話履歴のアクセス権設定
    const historyAccess = this.setupHistoryAccess(
      primaryPersona.id,
      secondaryPersonas.map(p => p.id),
      strategy.history_access
    );
    
    // 4. 統合履歴の記録
    await this.recordMergeAudit({
      primary_persona_id: primaryPersona.id,
      merged_persona_ids: secondaryPersonas.map(p => p.id),
      strategy: strategy,
      timestamp: new Date()
    });
    
    return {
      ...primaryPersona,
      capabilities: mergedCapabilities,
      permissions: mergedPermissions,
      history_access: historyAccess
    };
  }
}
```

#### 3. 会話履歴の効率的引継ぎ
```sql
-- 統合後の履歴アクセス用ビュー
CREATE VIEW merged_conversation_history AS
SELECT 
    h.*,
    pm.primary_persona_id,
    'merged' as access_type
FROM conversation_history h
JOIN persona_merges pm ON h.persona_id = pm.secondary_persona_id
WHERE pm.merge_status = 'completed'

UNION ALL

SELECT 
    h.*,
    h.persona_id as primary_persona_id,
    'direct' as access_type  
FROM conversation_history h
WHERE h.persona_id NOT IN (
    SELECT secondary_persona_id FROM persona_merges WHERE merge_status = 'completed'
);
```

---

## �🔧 新規ツール・API 設計

### 1. プロンプト最適化ツール

#### `prompt-optimize`
```json
{
    "name": "prompt-optimize",
    "description": "システムプロンプトのトークン数最適化",
    "inputSchema": {
        "type": "object",
        "properties": {
            "base_prompt": {"type": "string"},
            "task_context": {"type": "string"},
            "max_tokens": {"type": "number", "default": 4000},
            "model": {"type": "string", "default": "gpt-4"}
        }
    }
}
```

#### `capability-compress`
```json
{
    "name": "capability-compress",
    "description": "人格能力情報の要約・圧縮",
    "inputSchema": {
        "type": "object",
        "properties": {
            "persona_id": {"type": "string"},
            "compression_level": {"type": "string", "enum": ["light", "medium", "heavy"]},
            "task_context": {"type": "string", "description": "タスク適応型選択用"}
        }
    }
}
```

### 2. 人格統合管理ツール

#### `persona-similarity-analyze`
```json
{
    "name": "persona-similarity-analyze",
    "description": "人格類似度分析・統合候補検出",
    "inputSchema": {
        "type": "object",
        "properties": {
            "target_persona_id": {"type": "string"},
            "similarity_threshold": {"type": "number", "default": 0.7},
            "include_recommendations": {"type": "boolean", "default": true}
        }
    }
}
```

#### `persona-merge-execute`
```json
{
    "name": "persona-merge-execute", 
    "description": "人格統合実行（管理者権限必須）",
    "inputSchema": {
        "type": "object",
        "properties": {
            "primary_persona_id": {"type": "string"},
            "secondary_persona_ids": {"type": "array", "items": {"type": "string"}},
            "merge_strategy": {
                "type": "object",
                "properties": {
                    "capability_merge": {"type": "string", "enum": ["union", "intersection", "manual"]},
                    "permission_merge": {"type": "string", "enum": ["most_restrictive", "most_permissive", "manual"]},
                    "history_access": {"type": "string", "enum": ["full", "summary", "restricted"]}
                }
            },
            "require_approval": {"type": "boolean", "default": true}
        }
    }
}
```

### 3. 人格能力管理ツール

#### `persona-capability-get`
```json
{
    "name": "persona-capability-get",
    "description": "人格の能力情報を取得",
    "inputSchema": {
        "type": "object",
        "properties": {
            "persona_id": {"type": "string", "description": "人格ID（null=自分）"},
            "include_others": {"type": "boolean", "description": "他人格能力も含む"}
        }
    }
}
```

#### `persona-capability-search`
```json
{
    "name": "persona-capability-search",
    "description": "能力ベースで人格を検索",
    "inputSchema": {
        "type": "object",
        "properties": {
            "required_tools": {"type": "array", "items": {"type": "string"}},
            "expertise": {"type": "array", "items": {"type": "string"}},
            "exclude_restrictions": {"type": "array", "items": {"type": "string"}}
        }
    }
}
```

#### `task-delegate`
```json
{
    "name": "task-delegate",
    "description": "他人格にタスクを委譲",
    "inputSchema": {
        "type": "object",
        "properties": {
            "target_persona_id": {"type": "string"},
            "task_description": {"type": "string"},
            "required_capabilities": {"type": "array", "items": {"type": "string"}},
            "max_wait_time": {"type": "number", "default": 300}
        }
    }
}
```

### 2. 人格管理ツール（管理者専用）

#### `persona-create-advanced`
```json
{
    "name": "persona-create-advanced",
    "description": "人格作成（管理者権限必須）",
    "inputSchema": {
        "type": "object",
        "properties": {
            "name": {"type": "string"},
            "personality": {"type": "string"},
            "capabilities": {
                "type": "object",
                "properties": {
                    "tools": {"type": "array", "items": {"type": "string"}},
                    "expertise": {"type": "array", "items": {"type": "string"}},
                    "restrictions": {"type": "array", "items": {"type": "string"}}
                }
            },
            "initial_role": {"type": "string", "default": "user"}
        }
    }
}
```

---

## 🔒 セキュリティ実装計画

### 【STRIDE分析と対策】

#### 1. Information Disclosure (情報漏洩)
- **脅威**: 能力情報・委譲内容の漏洩
- **対策**: 
  - 能力情報の暗号化保存
  - アクセス制御による参照制限
  - 委譲時の情報最小化

#### 2. Spoofing (なりすまし)
- **脅威**: 管理者人格のなりすまし
- **対策**:
  - 管理者人格の強固な認証
  - セッション管理の強化
  - 操作履歴の監査

#### 3. Elevation of Privilege (権限昇格)
- **脅威**: 一般人格が管理者権限を取得
- **対策**:
  - RBAC による厳格な権限管理
  - 権限変更の多段承認
  - 権限操作の監査ログ

### 【実装優先度の高いセキュリティ対策】

1. **プロンプトインジェクション防止**
   ```typescript
   // 能力情報のサニタイズ・検証
   function sanitizeCapabilityInfo(capabilities: PersonaCapabilities): PersonaCapabilities {
       return {
           tools: capabilities.tools.map(tool => sanitizeString(tool)),
           expertise: capabilities.expertise.map(exp => sanitizeString(exp)),
           restrictions: capabilities.restrictions.map(res => sanitizeString(res)),
           description: sanitizeString(capabilities.description)
       };
   }
   
   // プロンプト注入検出
   function detectPromptInjection(text: string): boolean {
       const dangerousPatterns = [
           /ignore\s+previous\s+instructions/i,
           /system\s*:\s*/i,
           /assistant\s*:\s*/i,
           /<\/?[^>]+(>|$)/g  // HTMLタグ
       ];
       return dangerousPatterns.some(pattern => pattern.test(text));
   }
   ```

2. **統合時の権限管理強化**
   ```typescript
   // 最小権限原則での権限マージ
   function mergePermissionsSecurely(
       primaryPerms: Permission[], 
       secondaryPerms: Permission[]
   ): Permission[] {
       // 最も制限的な権限を採用
       const mergedPerms = primaryPerms.filter(perm => 
           secondaryPerms.some(sPerm => 
               sPerm.action === perm.action && sPerm.level <= perm.level
           )
       );
       
       // 統合操作を監査ログに記録
       auditLog.record({
           action: 'permission_merge',
           before: { primary: primaryPerms, secondary: secondaryPerms },
           after: mergedPerms,
           timestamp: new Date()
       });
       
       return mergedPerms;
   }
   ```

3. **会話履歴の安全な引継ぎ**
   ```typescript
   // 機密情報フィルタリング
   function filterSensitiveHistory(
       history: ConversationHistory[], 
       targetPersonaPermissions: Permission[]
   ): ConversationHistory[] {
       return history.filter(entry => {
           // 機密レベルチェック
           if (entry.sensitivity_level > getMaxAccessLevel(targetPersonaPermissions)) {
               return false;
           }
           
           // 個人情報パターン検出・除去
           entry.content = removePII(entry.content);
           
           return true;
       });
   }
   ```

4. **統合操作の監査強化**
   ```typescript
   // 不可改監査ログ
   interface MergeAuditRecord {
       id: string;
       primary_persona_id: string;
       secondary_persona_ids: string[];
       merge_strategy: MergeStrategy;
       capability_changes: CapabilityDiff;
       permission_changes: PermissionDiff;
       history_access_granted: string[];
       operator_id: string;
       timestamp: Date;
       hash: string;  // 改ざん検知用
   }
   
   async function recordSecureMergeAudit(record: MergeAuditRecord): Promise<void> {
       // ハッシュ生成（改ざん検知）
       record.hash = generateHash(JSON.stringify(record));
       
       // 不可改ストレージに記録
       await immutableAuditStore.write(record);
       
       // アラート送信（重要操作）
       await alertingService.notify('persona_merge_executed', record);
   }
   ```

---

## 📈 実装フェーズ計画（更新版）

### 【Phase 1: 基盤システム構築】（Week 1-2）
- [ ] データベーススキーマ拡張（人格能力・統合履歴）
- [ ] システムプロンプト最適化基盤
  - [ ] トークン数計算モジュール（tiktoken統合）
  - [ ] 能力情報要約・圧縮API
  - [ ] プロンプトテンプレート設計
- [ ] セキュリティ基盤強化
  - [ ] プロンプトインジェクション検出・防止
  - [ ] 能力情報のサニタイズ・検証

### 【Phase 2: 能力管理・統合システム】（Week 3-4）
- [ ] 人格能力CRUD API実装
- [ ] 類似度分析・統合システム
  - [ ] 人格ベクトル化・類似度計算
  - [ ] 統合候補検出・推奨システム
  - [ ] 統合実行・データマージ機能
- [ ] 会話履歴引継ぎシステム
  - [ ] 履歴アクセス権管理
  - [ ] 機密情報フィルタリング

### 【Phase 3: 高度機能・セキュリティ強化】（Week 5-6）
- [ ] タスク適応型能力選択
- [ ] 統合操作の監査・アラート機能
- [ ] パフォーマンス最適化
  - [ ] 能力情報キャッシュシステム
  - [ ] 類似度計算の高速化
- [ ] セキュリティテスト・脆弱性検査

### 【Phase 4: 統合テスト・運用準備】（Week 7-8）
- [ ] エンドツーエンドテスト
- [ ] プロンプト最適化のパフォーマンステスト
- [ ] 人格統合機能の総合テスト
- [ ] VS Code・Claude Desktop統合テスト
- [ ] 運用手順書更新・セキュリティドキュメント作成

---

## 🎯 成功指標・検証項目（更新版）

### 【プロンプト最適化検証】
- [ ] システムプロンプトのトークン数が50%以上削減される
- [ ] タスク適応型選択で関連性90%以上を維持
- [ ] プロンプト生成時間が100ms以内
- [ ] プロンプトインジェクション攻撃が100%検出・防止される

### 【人格統合機能検証】
- [ ] 類似度90%以上の人格が正確に検出される
- [ ] 統合後の能力情報に矛盾・漏れがない
- [ ] 履歴アクセス権が適切に引き継がれる
- [ ] 統合操作が完全に監査ログに記録される

### 【セキュリティ検証】
- [ ] 権限昇格攻撃が防げる
- [ ] 統合時の機密情報漏洩が防げる
- [ ] 不正な統合操作が検出・阻止される
- [ ] 監査ログの改ざんが検出される

### 【パフォーマンス検証】
- [ ] 能力検索が500ms以内に完了
- [ ] 類似度分析が2秒以内に完了
- [ ] 統合処理が10秒以内に完了
- [ ] 同時100人格でも安定動作

---

## 🚀 次ステップ

### **1. 即座に開始可能な作業**
- データベーススキーマ拡張設計
- トークン数計算モジュールの実装
- プロンプトインジェクション検出パターンの定義

### **2. 技術検証が必要な項目**
- 能力情報ベクトル化手法の選定（Word2Vec vs Sentence-BERT）
- 類似度閾値の最適化（統合精度 vs 誤検出のバランス）
- プロンプト要約品質の評価基準

### **3. 運用・セキュリティ準備**
- 人格統合の承認ワークフロー設計
- 監査ログの保存・分析方針策定
- セキュリティインシデント対応手順

**Phase 1の詳細実装から始めますか？** 🔥

---

**最終更新**: 2025年7月19日  
**文書バージョン**: 1.0.0  
**次期レビュー**: Phase 1完了時
