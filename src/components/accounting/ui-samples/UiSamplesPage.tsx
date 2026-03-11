"use client"

import { useState } from "react"
import { Layers, Check, Minus, Copy } from "lucide-react"
import { toast } from "sonner"

// ========================================
// コピー用ユーティリティ
// ========================================
function copyText(text: string) {
  navigator.clipboard.writeText(text)
  toast.success(`コピー: ${text}`)
}

function SampleLabel({ label, code }: { label: string; code: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-1">
      <span className="text-[11px] font-bold text-slate-700">{label}</span>
      <button
        onClick={() => copyText(code)}
        className="text-[9px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded hover:bg-slate-200 transition-colors flex items-center gap-0.5"
        title="クリックでコピー"
      >
        <Copy className="w-2.5 h-2.5" />
        {code}
      </button>
    </div>
  )
}

// ========================================
// セクションラッパー
// ========================================
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="text-sm font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100">{title}</h3>
      {children}
    </div>
  )
}

// ========================================
// メインコンポーネント
// ========================================
export function UiSamplesPage() {
  const [checkStates, setCheckStates] = useState<Record<string, boolean>>({})

  function toggleCheck(id: string) {
    setCheckStates((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* ヘッダー */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-500" />
            UIデザインサンプル
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            ボタン・角丸・影・グラデーション・チェックボックス等のサンプル集。クラス名をクリックでコピー
          </p>
        </div>
      </div>

      <div className="flex-1 px-6 py-4 space-y-6">

        {/* ============================================ */}
        {/* ボタンサイズ */}
        {/* ============================================ */}
        <Section title="1. ボタンサイズ">
          <div className="flex items-end gap-4 flex-wrap">
            {[
              { label: "XS", code: "px-2 py-1 text-xs", cls: "px-2 py-1 text-xs" },
              { label: "SM", code: "px-3 py-1.5 text-sm", cls: "px-3 py-1.5 text-sm" },
              { label: "MD（標準）", code: "px-4 py-2 text-sm", cls: "px-4 py-2 text-sm" },
              { label: "LG", code: "px-5 py-2.5 text-base", cls: "px-5 py-2.5 text-base" },
              { label: "XL", code: "px-6 py-3 text-lg", cls: "px-6 py-3 text-lg" },
              { label: "2XL", code: "px-8 py-4 text-xl", cls: "px-8 py-4 text-xl" },
            ].map((b) => (
              <div key={b.label} className="text-center">
                <SampleLabel label={b.label} code={b.code} />
                <button className={`${b.cls} bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition-colors`}>
                  ボタン
                </button>
              </div>
            ))}
          </div>
        </Section>

        {/* ============================================ */}
        {/* 角丸バリエーション */}
        {/* ============================================ */}
        <Section title="2. 角丸（border-radius）">
          <div className="flex items-center gap-4 flex-wrap">
            {[
              { label: "角なし", code: "rounded-none", cls: "rounded-none" },
              { label: "極小", code: "rounded-sm", cls: "rounded-sm" },
              { label: "小", code: "rounded", cls: "rounded" },
              { label: "中", code: "rounded-md", cls: "rounded-md" },
              { label: "標準", code: "rounded-lg", cls: "rounded-lg" },
              { label: "大", code: "rounded-xl", cls: "rounded-xl" },
              { label: "特大", code: "rounded-2xl", cls: "rounded-2xl" },
              { label: "極大", code: "rounded-3xl", cls: "rounded-3xl" },
              { label: "丸", code: "rounded-full", cls: "rounded-full" },
            ].map((r) => (
              <div key={r.label} className="text-center">
                <SampleLabel label={r.label} code={r.code} />
                <div className={`w-24 h-16 bg-blue-500 ${r.cls} flex items-center justify-center`}>
                  <span className="text-white text-xs font-medium">{r.label}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <h4 className="text-xs font-bold text-slate-600 mb-3">角丸ボタン比較（同じサイズ）</h4>
            <div className="flex items-center gap-3 flex-wrap">
              {[
                { label: "角ばり", code: "rounded-none" },
                { label: "少し角ばり", code: "rounded-sm" },
                { label: "やや角丸", code: "rounded" },
                { label: "標準", code: "rounded-md" },
                { label: "やや丸", code: "rounded-lg" },
                { label: "丸め", code: "rounded-xl" },
                { label: "かなり丸", code: "rounded-2xl" },
                { label: "ピル型", code: "rounded-full" },
              ].map((r) => (
                <div key={r.code} className="text-center">
                  <SampleLabel label={r.label} code={r.code} />
                  <button className={`px-5 py-2.5 bg-slate-800 text-white text-sm font-medium ${r.code} hover:bg-slate-700 transition-colors`}>
                    保存する
                  </button>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* ============================================ */}
        {/* 影（box-shadow） */}
        {/* ============================================ */}
        <Section title="3. 影（box-shadow）">
          <div className="flex items-center gap-5 flex-wrap">
            {[
              { label: "影なし", code: "shadow-none" },
              { label: "極小", code: "shadow-sm" },
              { label: "小", code: "shadow" },
              { label: "中", code: "shadow-md" },
              { label: "大", code: "shadow-lg" },
              { label: "特大", code: "shadow-xl" },
              { label: "極大", code: "shadow-2xl" },
            ].map((s) => (
              <div key={s.code} className="text-center">
                <SampleLabel label={s.label} code={s.code} />
                <div className={`w-28 h-20 bg-white rounded-lg border border-slate-100 ${s.code} flex items-center justify-center`}>
                  <span className="text-xs text-slate-500">{s.label}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <h4 className="text-xs font-bold text-slate-600 mb-3">色付き影</h4>
            <div className="flex items-center gap-4 flex-wrap">
              {[
                { label: "青い影", code: "shadow-lg shadow-blue-500/30", color: "bg-blue-500" },
                { label: "赤い影", code: "shadow-lg shadow-red-500/30", color: "bg-red-500" },
                { label: "緑の影", code: "shadow-lg shadow-emerald-500/30", color: "bg-emerald-500" },
                { label: "紫の影", code: "shadow-lg shadow-violet-500/30", color: "bg-violet-500" },
                { label: "オレンジ影", code: "shadow-lg shadow-orange-500/30", color: "bg-orange-500" },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <SampleLabel label={s.label} code={s.code} />
                  <button className={`px-5 py-2.5 ${s.color} text-white text-sm font-medium rounded-lg ${s.code} hover:opacity-90 transition-opacity`}>
                    ボタン
                  </button>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* ============================================ */}
        {/* グラデーション */}
        {/* ============================================ */}
        <Section title="4. グラデーション">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {[
              { label: "青→紫", code: "bg-gradient-to-r from-blue-500 to-violet-500" },
              { label: "青→シアン", code: "bg-gradient-to-r from-blue-500 to-cyan-400" },
              { label: "紫→ピンク", code: "bg-gradient-to-r from-violet-500 to-pink-500" },
              { label: "緑→エメラルド", code: "bg-gradient-to-r from-green-500 to-emerald-400" },
              { label: "オレンジ→赤", code: "bg-gradient-to-r from-orange-500 to-red-500" },
              { label: "黄→オレンジ", code: "bg-gradient-to-r from-yellow-400 to-orange-500" },
              { label: "ピンク→ローズ", code: "bg-gradient-to-r from-pink-500 to-rose-500" },
              { label: "インディゴ→青", code: "bg-gradient-to-r from-indigo-500 to-blue-500" },
              { label: "ティール→緑", code: "bg-gradient-to-r from-teal-500 to-green-400" },
              { label: "スレート→グレー", code: "bg-gradient-to-r from-slate-700 to-slate-500" },
              { label: "黒→スレート", code: "bg-gradient-to-r from-gray-900 to-slate-700" },
              { label: "ローズ→アンバー", code: "bg-gradient-to-r from-rose-500 to-amber-400" },
            ].map((g) => (
              <div key={g.label}>
                <SampleLabel label={g.label} code={g.code} />
                <div className={`h-14 rounded-lg ${g.code} flex items-center justify-center`}>
                  <span className="text-white text-xs font-medium drop-shadow-sm">{g.label}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <h4 className="text-xs font-bold text-slate-600 mb-3">グラデーション方向</h4>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {[
                { label: "右へ", code: "bg-gradient-to-r" },
                { label: "左へ", code: "bg-gradient-to-l" },
                { label: "下へ", code: "bg-gradient-to-b" },
                { label: "上へ", code: "bg-gradient-to-t" },
                { label: "右下", code: "bg-gradient-to-br" },
                { label: "左上", code: "bg-gradient-to-tl" },
              ].map((d) => (
                <div key={d.code}>
                  <SampleLabel label={d.label} code={d.code} />
                  <div className={`h-14 rounded-lg ${d.code} from-blue-500 to-purple-500 flex items-center justify-center`}>
                    <span className="text-white text-xs font-medium">{d.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <h4 className="text-xs font-bold text-slate-600 mb-3">グラデーションボタン</h4>
            <div className="flex items-center gap-3 flex-wrap">
              {[
                { label: "青→紫", cls: "bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-600 hover:to-violet-600" },
                { label: "緑→ティール", cls: "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600" },
                { label: "オレンジ→赤", cls: "bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600" },
                { label: "ピンク→紫", cls: "bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600" },
                { label: "黒系", cls: "bg-gradient-to-r from-gray-800 to-slate-600 hover:from-gray-900 hover:to-slate-700" },
              ].map((g) => (
                <button key={g.label} className={`px-5 py-2.5 ${g.cls} text-white text-sm font-medium rounded-lg shadow-md transition-all`}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        </Section>

        {/* ============================================ */}
        {/* ボタンスタイルバリエーション */}
        {/* ============================================ */}
        <Section title="5. ボタンスタイル">
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-bold text-slate-600 mb-3">塗りつぶし（Solid）</h4>
              <div className="flex items-center gap-3 flex-wrap">
                {[
                  { label: "Blue", cls: "bg-blue-500 hover:bg-blue-600 text-white" },
                  { label: "Red", cls: "bg-red-500 hover:bg-red-600 text-white" },
                  { label: "Green", cls: "bg-emerald-500 hover:bg-emerald-600 text-white" },
                  { label: "Orange", cls: "bg-orange-500 hover:bg-orange-600 text-white" },
                  { label: "Purple", cls: "bg-violet-500 hover:bg-violet-600 text-white" },
                  { label: "Black", cls: "bg-slate-800 hover:bg-slate-900 text-white" },
                ].map((b) => (
                  <button key={b.label} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${b.cls}`}>{b.label}</button>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-600 mb-3">アウトライン（Outline）</h4>
              <div className="flex items-center gap-3 flex-wrap">
                {[
                  { label: "Blue", cls: "border-2 border-blue-500 text-blue-500 hover:bg-blue-50" },
                  { label: "Red", cls: "border-2 border-red-500 text-red-500 hover:bg-red-50" },
                  { label: "Green", cls: "border-2 border-emerald-500 text-emerald-500 hover:bg-emerald-50" },
                  { label: "Orange", cls: "border-2 border-orange-500 text-orange-500 hover:bg-orange-50" },
                  { label: "Purple", cls: "border-2 border-violet-500 text-violet-500 hover:bg-violet-50" },
                  { label: "Black", cls: "border-2 border-slate-800 text-slate-800 hover:bg-slate-50" },
                ].map((b) => (
                  <button key={b.label} className={`px-4 py-2 text-sm font-medium rounded-lg bg-white transition-colors ${b.cls}`}>{b.label}</button>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-600 mb-3">ソフト（Soft / Ghost）</h4>
              <div className="flex items-center gap-3 flex-wrap">
                {[
                  { label: "Blue", cls: "bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200" },
                  { label: "Red", cls: "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200" },
                  { label: "Green", cls: "bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200" },
                  { label: "Orange", cls: "bg-orange-50 text-orange-600 hover:bg-orange-100 border border-orange-200" },
                  { label: "Purple", cls: "bg-violet-50 text-violet-600 hover:bg-violet-100 border border-violet-200" },
                  { label: "Gray", cls: "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200" },
                ].map((b) => (
                  <button key={b.label} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${b.cls}`}>{b.label}</button>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-600 mb-3">テキストのみ（Link風）</h4>
              <div className="flex items-center gap-3 flex-wrap">
                {[
                  { label: "Blue", cls: "text-blue-500 hover:text-blue-700 hover:underline" },
                  { label: "Red", cls: "text-red-500 hover:text-red-700 hover:underline" },
                  { label: "Black", cls: "text-slate-600 hover:text-slate-800 hover:underline" },
                ].map((b) => (
                  <button key={b.label} className={`px-4 py-2 text-sm font-medium transition-colors ${b.cls}`}>{b.label}</button>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* ============================================ */}
        {/* ボーダー */}
        {/* ============================================ */}
        <Section title="6. ボーダー（枠線）">
          <div className="flex items-center gap-4 flex-wrap">
            {[
              { label: "なし", code: "border-0" },
              { label: "1px", code: "border" },
              { label: "2px", code: "border-2" },
              { label: "4px", code: "border-4" },
              { label: "上のみ", code: "border-t-2" },
              { label: "下のみ", code: "border-b-2" },
              { label: "左のみ", code: "border-l-4" },
            ].map((b) => (
              <div key={b.label} className="text-center">
                <SampleLabel label={b.label} code={b.code} />
                <div className={`w-24 h-16 bg-white ${b.code} border-blue-500 rounded-lg flex items-center justify-center`}>
                  <span className="text-xs text-slate-500">{b.label}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ============================================ */}
        {/* チェックボックス */}
        {/* ============================================ */}
        <Section title="7. チェックボックス">
          <div className="space-y-6">
            <div>
              <h4 className="text-xs font-bold text-slate-600 mb-3">スタイル A: 標準チェック</h4>
              <div className="flex items-center gap-6 flex-wrap">
                {[
                  { id: "a1", label: "Blue", color: "bg-blue-500 border-blue-500", ring: "ring-blue-200" },
                  { id: "a2", label: "Green", color: "bg-emerald-500 border-emerald-500", ring: "ring-emerald-200" },
                  { id: "a3", label: "Red", color: "bg-red-500 border-red-500", ring: "ring-red-200" },
                  { id: "a4", label: "Purple", color: "bg-violet-500 border-violet-500", ring: "ring-violet-200" },
                  { id: "a5", label: "Orange", color: "bg-orange-500 border-orange-500", ring: "ring-orange-200" },
                  { id: "a6", label: "Black", color: "bg-slate-800 border-slate-800", ring: "ring-slate-200" },
                ].map((c) => (
                  <label key={c.id} className="flex items-center gap-2 cursor-pointer group">
                    <button
                      onClick={() => toggleCheck(c.id)}
                      className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-all ${
                        checkStates[c.id]
                          ? `${c.color} text-white ring-2 ${c.ring}`
                          : "border-slate-300 bg-white group-hover:border-slate-400"
                      }`}
                    >
                      {checkStates[c.id] && <Check className="w-3.5 h-3.5" />}
                    </button>
                    <span className="text-sm text-slate-700">{c.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-600 mb-3">スタイル B: 角丸バリエーション</h4>
              <div className="flex items-center gap-6 flex-wrap">
                {[
                  { id: "b1", label: "角なし", rounded: "rounded-none" },
                  { id: "b2", label: "極小", rounded: "rounded-sm" },
                  { id: "b3", label: "標準", rounded: "rounded" },
                  { id: "b4", label: "中", rounded: "rounded-md" },
                  { id: "b5", label: "大", rounded: "rounded-lg" },
                  { id: "b6", label: "丸", rounded: "rounded-full" },
                ].map((c) => (
                  <label key={c.id} className="flex items-center gap-2 cursor-pointer group">
                    <button
                      onClick={() => toggleCheck(c.id)}
                      className={`w-5 h-5 ${c.rounded} flex items-center justify-center border-2 transition-all ${
                        checkStates[c.id]
                          ? "bg-blue-500 border-blue-500 text-white"
                          : "border-slate-300 bg-white group-hover:border-slate-400"
                      }`}
                    >
                      {checkStates[c.id] && <Check className="w-3.5 h-3.5" />}
                    </button>
                    <span className="text-sm text-slate-700">{c.label}（{c.rounded}）</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-600 mb-3">スタイル C: サイズバリエーション</h4>
              <div className="flex items-center gap-6 flex-wrap">
                {[
                  { id: "c1", label: "XS", size: "w-4 h-4", iconSize: "w-3 h-3" },
                  { id: "c2", label: "SM", size: "w-5 h-5", iconSize: "w-3.5 h-3.5" },
                  { id: "c3", label: "MD", size: "w-6 h-6", iconSize: "w-4 h-4" },
                  { id: "c4", label: "LG", size: "w-7 h-7", iconSize: "w-5 h-5" },
                  { id: "c5", label: "XL", size: "w-8 h-8", iconSize: "w-5 h-5" },
                ].map((c) => (
                  <label key={c.id} className="flex items-center gap-2 cursor-pointer group">
                    <button
                      onClick={() => toggleCheck(c.id)}
                      className={`${c.size} rounded flex items-center justify-center border-2 transition-all ${
                        checkStates[c.id]
                          ? "bg-blue-500 border-blue-500 text-white"
                          : "border-slate-300 bg-white group-hover:border-slate-400"
                      }`}
                    >
                      {checkStates[c.id] && <Check className={c.iconSize} />}
                    </button>
                    <span className="text-sm text-slate-700">{c.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-600 mb-3">スタイル D: スイッチ型トグル</h4>
              <div className="flex items-center gap-6 flex-wrap">
                {[
                  { id: "d1", label: "Blue", onBg: "bg-blue-500", offBg: "bg-slate-300" },
                  { id: "d2", label: "Green", onBg: "bg-emerald-500", offBg: "bg-slate-300" },
                  { id: "d3", label: "Red", onBg: "bg-red-500", offBg: "bg-slate-300" },
                  { id: "d4", label: "Purple", onBg: "bg-violet-500", offBg: "bg-slate-300" },
                ].map((s) => (
                  <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                    <button
                      onClick={() => toggleCheck(s.id)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${checkStates[s.id] ? s.onBg : s.offBg}`}
                    >
                      <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform ${checkStates[s.id] ? "translate-x-5.5 left-0" : "left-0.5"}`}
                        style={{ transform: checkStates[s.id] ? "translateX(22px)" : "translateX(0)" }}
                      />
                    </button>
                    <span className="text-sm text-slate-700">{s.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-600 mb-3">スタイル E: カード型チェック</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { id: "e1", label: "オプション A", desc: "基本プラン" },
                  { id: "e2", label: "オプション B", desc: "標準プラン" },
                  { id: "e3", label: "オプション C", desc: "プレミアム" },
                  { id: "e4", label: "オプション D", desc: "カスタム" },
                ].map((c) => (
                  <button
                    key={c.id}
                    onClick={() => toggleCheck(c.id)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      checkStates[c.id]
                        ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-sm font-bold ${checkStates[c.id] ? "text-blue-700" : "text-slate-700"}`}>{c.label}</span>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        checkStates[c.id] ? "bg-blue-500 border-blue-500" : "border-slate-300"
                      }`}>
                        {checkStates[c.id] && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">{c.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-600 mb-3">スタイル F: ラインスルー型（取消線）</h4>
              <div className="space-y-2">
                {[
                  { id: "f1", label: "タスク1: 見積書を作成する" },
                  { id: "f2", label: "タスク2: 契約書を送付する" },
                  { id: "f3", label: "タスク3: 請求書を発行する" },
                ].map((t) => (
                  <label
                    key={t.id}
                    className="flex items-center gap-3 px-4 py-3 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <button
                      onClick={() => toggleCheck(t.id)}
                      className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-all flex-shrink-0 ${
                        checkStates[t.id]
                          ? "bg-emerald-500 border-emerald-500 text-white"
                          : "border-slate-300 bg-white"
                      }`}
                    >
                      {checkStates[t.id] && <Check className="w-3.5 h-3.5" />}
                    </button>
                    <span className={`text-sm transition-all ${
                      checkStates[t.id] ? "text-slate-400 line-through" : "text-slate-700"
                    }`}>
                      {t.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-600 mb-3">スタイル G: インデターミネート（中間状態）</h4>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded border-2 border-slate-300 bg-white flex items-center justify-center">
                  </div>
                  <span className="text-sm text-slate-700">未選択</span>
                </label>
                <label className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded border-2 border-blue-500 bg-blue-500 flex items-center justify-center">
                    <Minus className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="text-sm text-slate-700">一部選択</span>
                </label>
                <label className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded border-2 border-blue-500 bg-blue-500 flex items-center justify-center">
                    <Check className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="text-sm text-slate-700">全選択</span>
                </label>
              </div>
            </div>
          </div>
        </Section>

        {/* ============================================ */}
        {/* カード・パネル */}
        {/* ============================================ */}
        <Section title="8. カード・パネル">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <h4 className="font-bold text-sm text-slate-800 mb-1">フラット</h4>
              <p className="text-xs text-slate-500">border + rounded-lg</p>
            </div>
            <div className="bg-white rounded-xl shadow-md p-4">
              <h4 className="font-bold text-sm text-slate-800 mb-1">シャドウ</h4>
              <p className="text-xs text-slate-500">shadow-md + rounded-xl</p>
            </div>
            <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-4">
              <h4 className="font-bold text-sm text-slate-800 mb-1">リッチ</h4>
              <p className="text-xs text-slate-500">shadow-lg + border + rounded-2xl</p>
            </div>
            <div className="bg-gradient-to-br from-blue-500 to-violet-500 rounded-xl p-4 text-white">
              <h4 className="font-bold text-sm mb-1">グラデーション</h4>
              <p className="text-xs text-white/70">gradient + rounded-xl</p>
            </div>
            <div className="bg-white rounded-xl border-l-4 border-l-blue-500 border border-slate-200 p-4">
              <h4 className="font-bold text-sm text-slate-800 mb-1">左ライン</h4>
              <p className="text-xs text-slate-500">border-l-4 アクセント</p>
            </div>
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
              <h4 className="font-bold text-sm text-blue-800 mb-1">ソフトカラー</h4>
              <p className="text-xs text-blue-600">bg-blue-50 + border-blue-200</p>
            </div>
          </div>
        </Section>

        {/* ============================================ */}
        {/* バッジ・タグ */}
        {/* ============================================ */}
        <Section title="9. バッジ・タグ">
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-bold text-slate-600 mb-3">塗りつぶし</h4>
              <div className="flex items-center gap-2 flex-wrap">
                {["blue", "red", "emerald", "orange", "violet", "pink", "slate"].map((c) => (
                  <span key={c} className={`px-2.5 py-1 text-xs font-medium rounded-full bg-${c}-500 text-white`}>
                    {c}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-600 mb-3">ソフト</h4>
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { name: "新規", cls: "bg-blue-100 text-blue-700" },
                  { name: "進行中", cls: "bg-amber-100 text-amber-700" },
                  { name: "完了", cls: "bg-emerald-100 text-emerald-700" },
                  { name: "エラー", cls: "bg-red-100 text-red-700" },
                  { name: "保留", cls: "bg-slate-100 text-slate-600" },
                  { name: "重要", cls: "bg-violet-100 text-violet-700" },
                ].map((b) => (
                  <span key={b.name} className={`px-2.5 py-1 text-xs font-medium rounded-full ${b.cls}`}>{b.name}</span>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-600 mb-3">アウトライン</h4>
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { name: "Default", cls: "border border-slate-300 text-slate-600" },
                  { name: "Primary", cls: "border border-blue-300 text-blue-600" },
                  { name: "Success", cls: "border border-emerald-300 text-emerald-600" },
                  { name: "Warning", cls: "border border-amber-300 text-amber-600" },
                  { name: "Danger", cls: "border border-red-300 text-red-600" },
                ].map((b) => (
                  <span key={b.name} className={`px-2.5 py-1 text-xs font-medium rounded-full ${b.cls}`}>{b.name}</span>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-600 mb-3">角丸バリエーション</h4>
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { label: "角ばり", cls: "rounded-none" },
                  { label: "少し角丸", cls: "rounded" },
                  { label: "標準", cls: "rounded-md" },
                  { label: "丸め", cls: "rounded-lg" },
                  { label: "ピル型", cls: "rounded-full" },
                ].map((b) => (
                  <span key={b.label} className={`px-2.5 py-1 text-xs font-medium bg-blue-500 text-white ${b.cls}`}>{b.label}</span>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* ============================================ */}
        {/* 入力フィールド */}
        {/* ============================================ */}
        <Section title="10. 入力フィールド">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <SampleLabel label="標準" code="border rounded-lg" />
              <input type="text" placeholder="入力してください" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <SampleLabel label="角ばり" code="border rounded-none" />
              <input type="text" placeholder="入力してください" className="w-full border border-slate-200 rounded-none px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <SampleLabel label="丸め" code="border rounded-full" />
              <input type="text" placeholder="入力してください" className="w-full border border-slate-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <SampleLabel label="下線のみ" code="border-b-2 rounded-none" />
              <input type="text" placeholder="入力してください" className="w-full border-0 border-b-2 border-slate-200 rounded-none px-1 py-2 text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <SampleLabel label="背景つき" code="bg-slate-100 border-0" />
              <input type="text" placeholder="入力してください" className="w-full bg-slate-100 border-0 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <SampleLabel label="太枠" code="border-2 rounded-xl" />
              <input type="text" placeholder="入力してください" className="w-full border-2 border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400" />
            </div>
          </div>
        </Section>

      </div>
    </div>
  )
}
