AppleScriptを使ってGoogle Chromeを操作します。

## 前提条件
Chromeで「Apple Events からの JavaScript を許可」が有効であること。
設定方法: Chrome メニューバー → 表示 → 開発 / 管理 → Apple Events からの JavaScript を許可

## 重要: フォーカスをTerminalに戻す
Chrome操作のosascriptコマンドを実行するとChromeが前面に来てしまう。
**すべてのosascriptコマンド実行後に、以下を実行してTerminalを前面に戻すこと:**
```bash
osascript -e 'tell application "Terminal" to activate'
```
※ 複数のosascriptを連続実行する場合は、最後の1回だけでよい。

## 使い方
引数でアクションを指定できます。引数がない場合は現在のページ情報を取得して確認します。

## アクション一覧

### ページ確認（デフォルト）
引数なし、または `check` を指定した場合、以下を全て実行:

1. 現在のURL取得:
```bash
osascript -e 'tell application "Google Chrome" to return URL of active tab of window 1'
```

2. ページタイトル取得:
```bash
osascript -e 'tell application "Google Chrome" to return title of active tab of window 1'
```

3. ページ本文テキスト取得（先頭3000文字）:
```bash
osascript -e 'tell application "Google Chrome" to execute active tab of window 1 javascript "document.body.innerText.substring(0, 3000)"'
```

4. エラー要素チェック（画面上のエラー表示を検出）:
```bash
osascript -e 'tell application "Google Chrome" to execute active tab of window 1 javascript "
(function() {
  var errors = [];
  document.querySelectorAll(\"[role=alert], .error, .text-red-500, .text-destructive, [data-state=error]\").forEach(function(el) {
    if (el.textContent.trim()) errors.push(el.textContent.trim().substring(0, 200));
  });
  return errors.length > 0 ? \"エラー検出: \" + errors.join(\" | \") : \"エラーなし\";
})()
"'
```

5. 主要な見出し・ボタン・入力フィールドを取得:
```bash
osascript -e 'tell application "Google Chrome" to execute active tab of window 1 javascript "
(function() {
  var result = [];
  document.querySelectorAll(\"h1,h2,h3,button,[type=submit],input,select,textarea\").forEach(function(el) {
    var tag = el.tagName;
    var text = (el.textContent || el.placeholder || el.value || \"\").trim().substring(0, 100);
    var type = el.type || \"\";
    if (text) result.push(tag + (type ? \"[\" + type + \"]\" : \"\") + \": \" + text);
  });
  return result.slice(0, 50).join(\"\\n\");
})()
"'
```

上記の結果をすべて報告し、ページの状態を説明してください。

### スクリーンショット撮影
引数に `shot` を指定した場合:
```bash
screencapture -l $(osascript -e 'tell application "Google Chrome" to return id of window 1') /tmp/chrome-shot.png
```
失敗時は全画面: `screencapture -x /tmp/chrome-shot.png`
成功したらReadツールで `/tmp/chrome-shot.png` を表示して内容を説明。
失敗した場合は「画面収録の権限がありません。システム設定 > プライバシーとセキュリティ > 画面収録 でターミナルアプリに権限を付与してください」と案内。

### URL移動
引数に `open URL` または URLを指定した場合:
```bash
osascript -e 'tell application "Google Chrome" to set URL of active tab of window 1 to "指定URL"'
```
5秒待ってからページ確認を実行。

### リロード
引数に `reload` を指定した場合:
```bash
osascript -e 'tell application "Google Chrome" to reload active tab of window 1'
```
5秒待ってからページ確認を実行。

### ページのテキスト取得
引数に `text` を指定した場合:
```bash
osascript -e 'tell application "Google Chrome" to execute active tab of window 1 javascript "document.body.innerText"'
```

### 現在のURL取得
引数に `url` を指定した場合:
```bash
osascript -e 'tell application "Google Chrome" to return URL of active tab of window 1'
```

### コンソールエラー確認
引数に `errors` を指定した場合:
```bash
osascript -e 'tell application "Google Chrome" to execute active tab of window 1 javascript "
(function() {
  var errors = [];
  var entries = performance.getEntriesByType(\"resource\").filter(function(e) { return e.responseStatus >= 400; });
  entries.forEach(function(e) { errors.push(e.name + \" : \" + e.responseStatus); });
  return errors.length > 0 ? errors.join(\"\\n\") : \"エラーなし\";
})()
"'
```

### JavaScript実行
引数に `js コード` を指定した場合:
```bash
osascript -e 'tell application "Google Chrome" to execute active tab of window 1 javascript "指定コード"'
```

### localhost:3000を開く
引数に `dev` を指定した場合:
```bash
osascript -e 'tell application "Google Chrome" to set URL of active tab of window 1 to "http://localhost:3000"'
```
5秒待ってからページ確認を実行。

### 特定要素のテキスト確認
引数に `find CSSセレクタ` を指定した場合:
```bash
osascript -e 'tell application "Google Chrome" to execute active tab of window 1 javascript "
(function() {
  var els = document.querySelectorAll(\"指定セレクタ\");
  var results = [];
  els.forEach(function(el) { results.push(el.textContent.trim().substring(0, 200)); });
  return results.length > 0 ? results.join(\"\\n\") : \"要素が見つかりません\";
})()
"'
```

### テーブルデータ取得
引数に `table` を指定した場合:
```bash
osascript -e 'tell application "Google Chrome" to execute active tab of window 1 javascript "
(function() {
  var tables = document.querySelectorAll(\"table\");
  if (tables.length === 0) return \"テーブルなし\";
  var result = [];
  tables.forEach(function(t, i) {
    var rows = t.querySelectorAll(\"tr\");
    result.push(\"=== テーブル\" + (i+1) + \" (\" + rows.length + \"行) ===\");
    rows.forEach(function(r, j) {
      if (j < 10) {
        var cells = [];
        r.querySelectorAll(\"th,td\").forEach(function(c) { cells.push(c.textContent.trim().substring(0, 50)); });
        result.push(cells.join(\" | \"));
      }
    });
    if (rows.length > 10) result.push(\"...他\" + (rows.length - 10) + \"行\");
  });
  return result.join(\"\\n\");
})()
"'
```

## UI変更時の確認フロー（必須）
1. コード変更後、`/chrome reload` でリロード（自動で5秒待機+ページ確認）
2. 確認結果を分析し、変更が正しく反映されているか判断
3. 問題なければ完了報告、問題あれば修正して再度 `/chrome reload`
4. **確認前に「できました」と報告してはならない**
