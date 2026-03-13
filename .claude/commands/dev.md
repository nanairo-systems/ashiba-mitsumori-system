開発サーバーを起動します。

## 手順

1. 既にポート3000で起動中か確認:
   `lsof -i :3000 -t`

2. 起動中の場合:
   - 「開発サーバーは既に起動しています（PID: XXX）」と報告
   - ブラウザでリロード:
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

3. 起動していない場合:
   - `.next` キャッシュが壊れている可能性があるので削除: `rm -rf .next`
   - `npm run dev` をバックグラウンドで起動
   - サーバーが立ち上がるまで待機（最大30秒、`curl -s -o /dev/null -w "%{http_code}" http://localhost:3000` で確認）
   - 起動したらブラウザで開く:
     `osascript -e 'tell application "Google Chrome" to open location "http://localhost:3000"'`

4. 結果を報告（日本語）
