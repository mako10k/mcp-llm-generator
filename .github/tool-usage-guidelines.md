# Tool使用ガイドライン - 強制執行版

## 🚨 重要: mcp-shell-server 優先原則（必須遵守）

このプロジェクトでは**開発・テスト・運用の全段階**で `mcp-shell-server` を優先使用します。

### ❌ 禁止事項
- `run_in_terminal` の安易な使用
- 「一時的だから」という理由での非標準ツール使用
- セキュリティ・監査要件を無視したコマンド実行

### ✅ 必須事項
- 全てのコマンド実行は `mcp_mcp-shell-ser_shell_execute` を使用
- プロセス管理は `mcp_mcp-shell-ser_process_*` ツール群を使用
- 実行ログは `mcp_mcp-shell-ser_read_execution_output` で確認

---

## 使い分け基準（明確化）

| 用途 | mcp-shell-server | run_in_terminal | 根拠 |
|------|:----------------:|:---------------:|------|
| **プロダクション** | ◎ 必須 | ❌ 禁止 | セキュリティ・監査必須 |
| **開発・テスト** | ◎ 推奨 | △ 例外のみ | 一貫性・習慣化のため |
| **CI/CD** | ◎ 推奨 | △ 例外のみ | プロセス管理・ログ追跡 |
| **緊急デバッグ** | ○ 優先 | △ 最終手段 | セキュリティリスク最小化 |

---

## 例外ケース（厳格承認制）

### run_in_terminal 使用が許可される条件
1. **技術的制約**: mcp-shell-serverが物理的に利用不可能
2. **緊急事態**: システム障害でmcp-shell-serverが応答しない
3. **特殊環境**: Docker内部やCI/CD固有環境でのみ実行

### 例外使用時の必須手順
1. **事前承認**: チームリーダーまたはアーキテクトの承認
2. **理由記録**: 使用理由をコメント・ドキュメントに明記
3. **切り戻し計画**: mcp-shell-serverへの移行計画を併記

---

## 実装パターン（強制テンプレート）

### ✅ 正しいパターン
```typescript
// ビルド実行
mcp_mcp-shell-ser_shell_execute({
  "command": "cd /home/mako10k/mcp-sampler && npm run build",
  "execution_mode": "foreground"
});

// プロセス確認
mcp_mcp-shell-ser_process_list({"status_filter": "running"});

// ログ確認
mcp_mcp-shell-ser_read_execution_output({"output_id": "<output_id>"});
```

### ❌ 禁止パターン
```typescript
// これは使用禁止
run_in_terminal({
  "command": "npm test",
  "explanation": "テスト実行",
  "isBackground": false
});
```

---

## 自動検出・強制体制

### コードレビュー必須チェック項目
- [ ] `run_in_terminal` 使用箇所の確認
- [ ] mcp-shell-server 使用の妥当性確認
- [ ] 例外使用時の承認・理由記録確認

### 静的解析ルール（推奨）
```bash
# run_in_terminal 使用箇所を検出
grep -r "run_in_terminal" src/ --exclude-dir=node_modules
```

---

## 違反時の対応

### 軽微な違反（初回）
1. **教育・指導**: ガイドライン再周知
2. **コード修正**: mcp-shell-serverへの切り替え

### 重大な違反（繰り返し・本番）
1. **即座修正**: プルリクエスト差し戻し
2. **根本原因分析**: なぜ違反が発生したか調査
3. **再発防止策**: ガイドライン・レビュー体制の強化

---

## まとめ

**「mcp-shell-server が標準、run_in_terminal は例外」**

この原則を徹底することで：
- セキュリティリスクの最小化
- 監査ログによる完全な追跡可能性
- プロセス管理の一元化
- チーム開発の一貫性維持

**疑問・例外申請は必ずチームに相談してください。**
