feature-ui-edit → main への安全なマージ＆プッシュを行います。
必ずユーザーの承認を得てからpushしてください。

## 手順

### ステップ1: 前準備
1. `git status` で未コミットの変更がないか確認する
   - 未コミットの変更がある場合は「先に /sync で変更をコミットしてください」と案内して**中断する**
2. `git fetch origin` でリモートの最新を取得
3. `feature-ui-edit` で `git pull --rebase origin feature-ui-edit` を実行

### ステップ2: 差分確認
1. `git log --oneline main..feature-ui-edit` で未マージのコミット一覧を取得
   - 差分がない場合は「mainは最新です。マージ不要です」と報告して終了
2. `git diff --stat main..feature-ui-edit` で変更ファイル数・行数を取得
3. 新規ファイル一覧: `git diff --name-status main..feature-ui-edit | grep "^A"`
4. 削除ファイル一覧: `git diff --name-status main..feature-ui-edit | grep "^D"`

### ステップ3: 品質チェック
1. `npx tsc --noEmit` でTypeScriptエラーを確認
   - 既存の許容エラー（prisma関連等）以外の新規エラーがあれば警告する
2. マージコンフリクトの事前チェック: `git merge-tree $(git merge-base main feature-ui-edit) main feature-ui-edit` でコンフリクト有無を確認

### ステップ4: レポート作成＆ユーザー確認
以下の情報を日本語でまとめて報告し、**ユーザーの承認を求める**:

```
## main マージレポート

- コミット数: X件
- 変更ファイル数: X件（追加 X / 削除 X / 変更 X）
- 追加行数: +X / 削除行数: -X
- TypeScriptチェック: ✅ OK / ⚠️ 警告あり
- コンフリクト: なし / あり（詳細）

### 主要な変更内容
- （コミットメッセージから主要な変更を3〜5項目で要約）

### 新規ファイル（あれば）
- ファイルパス一覧

### 削除ファイル（あれば）
- ファイルパス一覧

mainにマージ＆プッシュしてよろしいですか？（Vercelで本番自動デプロイされます）
```

**ここで必ず停止してユーザーの回答を待つこと。自動的にマージしないこと。**

### ステップ5: マージ＆プッシュ（承認後のみ）
ユーザーが承認した場合のみ以下を実行:

1. `git checkout main`
2. `git pull origin main`
3. `git merge feature-ui-edit --no-edit`
4. `git push origin main`
5. `git checkout feature-ui-edit`
6. 音声通知: `say -v "Rocko (日本語（日本）)" "メインへのマージが完了しました。本番デプロイが開始されます"`

ユーザーが拒否した場合は「マージを中止しました」と報告して終了。
