以下の手順を順番に実行してください。

1. `git status` と `git diff` で未コミットの変更を確認する
2. 変更がある場合:
   - 変更内容を分析して適切なコミットメッセージを作成
   - `git add` で関連ファイルをステージング
   - コミットを作成（Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com> を付与）
3. `git fetch origin` でリモートの最新を取得
4. リモートに新しいコミットがあれば `git pull --rebase` で統合
5. `git push origin feature-ui-edit` でプッシュ
6. 変更内容のサマリーを日本語で報告（何が変わったか、何件のファイル等）
7. 完了後、音声通知を実行:
   `say -v "Flo (日本語（日本）)" "同期が完了しました。（変更内容の要約）"`

変更がない場合でも、リモートとの同期（pull/push）は実行し、「変更なし・同期済み」と報告してください。
