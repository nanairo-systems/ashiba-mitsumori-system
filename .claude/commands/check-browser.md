ブラウザでアプリの動作確認を行います。

## 手順

1. **開発サーバー確認**: `lsof -i :3000` でサーバーが起動しているか確認
   - 起動していない場合はユーザーに `npm run dev` を提案
2. **Chromeで対象ページを開く**:
   ```bash
   osascript -e 'tell application "Google Chrome" to set URL of active tab of front window to "http://localhost:3000"'
   ```
3. **ページの読み込み確認**: タイトルを取得して正常にロードされているか確認
   ```bash
   osascript -e 'tell application "Google Chrome" to get title of active tab of front window'
   ```
4. **確認項目**（ユーザーの指示に応じて）:
   - 特定ページのUI表示確認
   - ナビゲーション動作確認
   - エラーの有無確認（コンソールログ取得）
   ```bash
   osascript -e 'tell application "Google Chrome" to execute active tab of front window javascript "JSON.stringify(window.__NEXT_DATA__?.err || ''no errors'')"'
   ```
5. **結果報告**: 確認結果を日本語で報告
6. **音声通知**:
   `say -v "Flo (日本語（日本）)" "ブラウザ確認が完了しました。（確認結果の要約）"`

## MCP Playwright との使い分け
- **このコマンド（/check-browser）**: 簡易的なUI確認、ページ表示チェック
- **MCP Playwright**: 詳細なUI操作テスト、クリック・入力・スクリーンショット取得など高度な操作
