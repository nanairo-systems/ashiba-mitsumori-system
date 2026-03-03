/**
 * [COMPONENT] KeyboardHint - キーボードショートカットヒント
 *
 * 画面上にキーボードショートカットのヒントを表示する。
 * 半透明のピルで統一デザイン。
 */

interface KeyboardHintProps {
  /** 表示するキー名（例: "Esc"） */
  keyName: string
  /** 操作の説明（例: "閉じる"） */
  label: string
  /** 追加のclassName */
  className?: string
}

export function KeyboardHint({ keyName, label, className = "" }: KeyboardHintProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] text-slate-400 select-none ${className}`}
    >
      <kbd className="inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-mono font-semibold text-slate-500 shadow-[0_1px_0_0_rgba(0,0,0,0.05)]">
        {keyName}
      </kbd>
      <span>{label}</span>
    </span>
  )
}
