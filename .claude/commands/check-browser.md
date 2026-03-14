ブラウザでアプリの動作確認を行います。

## 前提条件
Chromeで「Apple Events からの JavaScript を許可」が有効であること。
設定方法: Chrome メニューバー → 表示 → 開発 / 管理 → Apple Events からの JavaScript を許可

## 手順

### 1. 現在のページ情報を取得
```bash
echo "=== URL ===" && osascript -e 'tell application "Google Chrome" to return URL of active tab of window 1' && echo "=== TITLE ===" && osascript -e 'tell application "Google Chrome" to return title of active tab of window 1'
```

### 2. エラーチェック
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

### 3. ページ構造を確認
```bash
osascript -e 'tell application "Google Chrome" to execute active tab of window 1 javascript "
(function() {
  var result = [];
  document.querySelectorAll(\"h1,h2,h3,button,[type=submit],input,select,textarea\").forEach(function(el) {
    var tag = el.tagName;
    var text = (el.textContent || el.placeholder || el.value || \"\").trim().substring(0, 100);
    if (text) result.push(tag + \": \" + text);
  });
  return result.slice(0, 50).join(\"\\n\");
})()
"'
```

### 4. 確認結果を報告
- ページが正しく表示されているか
- エラーメッセージが表示されていないか
- 直前の変更が反映されているか
- レイアウト崩れの兆候がないか

### 5. 問題があれば修正
問題を発見した場合は、自動的に修正して再確認すること。

## 注意事項
- UI変更後は必ずこのコマンドを実行してから「完了」と報告すること
- 「できました」と言う前に必ずブラウザで確認すること
