AppleScriptを使ってGoogle Chromeを操作します。

ユーザーの指示に従って以下の操作を実行してください:

## 利用可能な操作

### ページ操作
- **URL移動**: 指定URLを開く / localhost:3000 の特定ページを開く
- **リロード**: 現在のページをリロード
- **タブ操作**: 新しいタブを開く / タブを切り替える

### 情報取得
- **現在のURL**: アクティブタブのURLを取得
- **ページタイトル**: アクティブタブのタイトルを取得
- **タブ一覧**: 開いているタブの一覧を取得

### JavaScript実行
- **要素クリック**: 指定セレクタの要素をクリック
- **テキスト入力**: 指定フィールドにテキストを入力
- **スクリーンショット**: ページの情報を取得

## 実行方法

AppleScriptは `osascript -e` コマンドで実行します。

例:
```bash
# URLを開く
osascript -e 'tell application "Google Chrome" to set URL of active tab of front window to "http://localhost:3000"'

# 現在のURLを取得
osascript -e 'tell application "Google Chrome" to get URL of active tab of front window'

# ページタイトルを取得
osascript -e 'tell application "Google Chrome" to get title of active tab of front window'

# JavaScriptを実行
osascript -e 'tell application "Google Chrome" to execute active tab of front window javascript "document.title"'

# リロード
osascript -e 'tell application "Google Chrome" to reload active tab of front window'
```

ユーザーの指示が曖昧な場合は、何をしたいか確認してください。
