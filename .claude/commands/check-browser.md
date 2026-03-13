ブラウザでアプリの動作確認を行います。

## 手順

1. 開発サーバーが起動しているか確認（`lsof -i :3000`）
   - 起動していない場合は「開発サーバーが起動していません」と報告して終了

2. AppleScript で Chrome の状態を確認:
   ```bash
   osascript -e 'tell application "Google Chrome" to get URL of active tab of front window'
   ```

3. localhost:3000 を開いてリロード:
   ```bash
   osascript -e 'tell application "Google Chrome"
     activate
     set targetURL to "http://localhost:3000"
     set found to false
     repeat with t in tabs of front window
       if URL of t starts with targetURL then
         set active tab index of front window to (index of t)
         reload t
         set found to true
         exit repeat
       end if
     end repeat
     if not found then open location targetURL
   end tell'
   ```

4. 3秒待ってからページタイトルを取得:
   ```bash
   sleep 3 && osascript -e 'tell application "Google Chrome" to get title of active tab of front window'
   ```

5. 結果を日本語で報告:
   - ページが正常に読み込まれたか
   - タイトルが期待通りか
   - エラーが表示されていないか（タイトルに "Error" が含まれていないか等）
