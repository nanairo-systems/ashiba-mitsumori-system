以下の手順を順番に実行してください。**mainへのマージは本番デプロイに直結するため、各ステップで確認を取ってください。**

1. `git status` で未コミットの変更がないことを確認
   - 変更がある場合は先に `/sync` を実行するよう提案して中断
2. `git fetch origin` でリモートの最新を取得
3. `git log origin/main..origin/feature-ui-edit --oneline` でマージ対象のコミット一覧を表示
4. マージ対象のコミット一覧をユーザーに見せて、mainへマージしてよいか確認を取る
5. 確認が取れたら:
   ```
   git checkout main
   git pull origin main
   git merge feature-ui-edit
   git push origin main
   git checkout feature-ui-edit
   ```
6. 結果を日本語で報告（マージしたコミット数、Vercelデプロイが開始されること）
7. 完了後、音声通知:
   `say -v "Flo (日本語（日本）)" "メインブランチへのマージが完了しました。Vercelへのデプロイが開始されます。（マージ内容の要約）"`

**注意**: ユーザーの明示的な承認なしにmainへのpushは絶対に行わないでください。
