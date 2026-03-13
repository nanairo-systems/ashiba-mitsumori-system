Google Chrome を AppleScript で操作します。

ユーザーの指示に応じて以下の操作を実行してください。

## 利用可能な操作

### 基本操作
```bash
# URLを開く
osascript -e 'tell application "Google Chrome" to open location "URL"'

# 新しいタブで開く
osascript -e 'tell application "Google Chrome" to tell front window to make new tab with properties {URL:"URL"}'

# 現在のタブをリロード
osascript -e 'tell application "Google Chrome" to reload active tab of front window'

# Chromeを最前面に
osascript -e 'tell application "Google Chrome" to activate'
```

### 情報取得
```bash
# 現在のURL取得
osascript -e 'tell application "Google Chrome" to get URL of active tab of front window'

# ページタイトル取得
osascript -e 'tell application "Google Chrome" to get title of active tab of front window'

# 全タブのURL一覧
osascript -e 'tell application "Google Chrome" to get URL of every tab of front window'

# タブ数取得
osascript -e 'tell application "Google Chrome" to get count of tabs of front window'
```

### タブ操作
```bash
# N番目のタブに切り替え
osascript -e 'tell application "Google Chrome" to set active tab index of front window to N'

# 現在のタブを閉じる
osascript -e 'tell application "Google Chrome" to close active tab of front window'
```

### JavaScript実行
```bash
# ページ内でJavaScriptを実行
osascript -e 'tell application "Google Chrome" to execute front window'\''s active tab javascript "JS_CODE"'
```

### よく使う複合操作
```bash
# localhost:3000を開いてリロード（開発確認用）
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

## 使い方
ユーザーの自然言語の指示を解釈して、適切な osascript コマンドを Bash ツールで実行してください。
操作結果（URL、タイトル等）は日本語で報告してください。
