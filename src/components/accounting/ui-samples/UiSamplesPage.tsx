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

        {/* ============================================ */}
        {/* フォント */}
        {/* ============================================ */}
        <Section title="11. フォントサイズ（使用箇所マップ付き）">
          <div className="space-y-3">
            {[
              { label: "text-xs", size: "text-xs", desc: "12px", modules: "SO-1〜6, CD-1〜5, PL-1〜7, ED-1〜12, NE-1〜4, SG-1〜6, WA-1〜6, MM-1〜11, IL-1〜6, PM-1〜4, TL-1〜2, NF-1〜3, ST-1〜4", role: "ラベル・バッジ・補足テキスト・テーブルセル" },
              { label: "text-sm", size: "text-sm", desc: "14px", modules: "SO-1〜5, CD-1〜5, PL-2〜7, ED-1〜12, NE-1〜4, SG-1〜6, WA-1〜5, MM-2〜11, IL-1〜6, PM-1〜4, TL-1〜2, NF-1〜3, ST-1〜4", role: "本文・フォーム入力・カード内テキスト" },
              { label: "text-base", size: "text-base", desc: "16px", modules: "MM-3, SG-3〜4, IL-4, PM-2", role: "強調テキスト・サマリー数値" },
              { label: "text-lg", size: "text-lg", desc: "18px", modules: "CD-3, PM-2, IL-4, ST-2", role: "セクション見出し・金額表示" },
              { label: "text-xl", size: "text-xl", desc: "20px", modules: "PL-5", role: "モバイル見出し" },
              { label: "text-2xl", size: "text-2xl", desc: "24px", modules: "SO-1, PL-2, ED-1, SG-1, MM-1, IL-1, PM-1, TL-1, NF-1, ST-1", role: "ページタイトル" },
              { label: "text-3xl", size: "text-3xl", desc: "30px", modules: "印刷レイアウト（契約書・請求書・見積書）", role: "印刷用タイトル" },
            ].map((f) => (
              <div key={f.label} className="border border-slate-100 rounded-lg p-3">
                <div className="flex items-baseline gap-3 mb-1.5">
                  <span className="w-14 text-[10px] font-mono text-slate-400 flex-shrink-0">{f.desc}</span>
                  <SampleLabel label="" code={f.label} />
                  <span className={`${f.size} text-slate-800 flex-shrink-0`}>足場見積 ABC 123</span>
                </div>
                <div className="flex items-start gap-2 ml-[68px]">
                  <span className="text-[10px] font-bold text-blue-600 flex-shrink-0">用途:</span>
                  <span className="text-[10px] text-slate-500">{f.role}</span>
                </div>
                <div className="flex items-start gap-2 ml-[68px] mt-0.5">
                  <span className="text-[10px] font-bold text-emerald-600 flex-shrink-0">使用:</span>
                  <span className="text-[10px] text-slate-400 leading-relaxed">{f.modules}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="12. フォントウェイト（使用箇所マップ付き）">
          <div className="space-y-3">
            {[
              { label: "font-normal", weight: "font-normal", val: "400", modules: "SO-2, CD-3, NE-1, MM-3", role: "通常テキスト・フォームラベル" },
              { label: "font-medium", weight: "font-medium", val: "500", modules: "SO-1〜2, CD-1〜3, PL-2〜5, ED-1〜3, NE-1〜2, SG-1〜6, WA-1〜5, MM-1〜11, IL-2〜6, PM-3〜4, TL-1〜2, NF-1〜3, ST-2〜4", role: "ボタンテキスト・カードラベル・サブ見出し" },
              { label: "font-semibold", weight: "font-semibold", val: "600", modules: "SO-2, CD-1〜2, PL-2〜6, ED-2〜3, NE-1, SG-1,4〜5, WA-1〜2,4, MM-2〜4,8〜9, IL-4〜5, PM-2〜4, ST-2〜4", role: "見積タイトル・サマリーヘッダ・テーブル行" },
              { label: "font-bold", weight: "font-bold", val: "700", modules: "SO-1〜4, CD-1〜3, PL-2〜7, ED-1〜3, NE-1〜2, SG-1〜6, WA-1〜5, MM-1〜11, IL-1〜6, PM-1〜4, TL-1〜2, NF-1〜3, ST-1〜4", role: "見出し・ページタイトル・強調ラベル（最多使用）" },
              { label: "font-extrabold", weight: "font-extrabold", val: "800", modules: "SO-1, CD-3, PL-2, WA-1〜2,5, MM-1, ST-1〜2", role: "会社名・ページメインタイトル・職長名" },
              { label: "font-black", weight: "font-black", val: "900", modules: "モジュールIDバッジ全般", role: "バッジ番号（赤ラベル）" },
            ].map((f) => (
              <div key={f.label} className="border border-slate-100 rounded-lg p-3">
                <div className="flex items-center gap-3 mb-1.5">
                  <span className="w-8 text-[10px] font-mono text-slate-400 flex-shrink-0">{f.val}</span>
                  <SampleLabel label="" code={f.label} />
                  <span className={`text-lg ${f.weight} text-slate-800`}>足場見積 ABC 123</span>
                </div>
                <div className="flex items-start gap-2 ml-10">
                  <span className="text-[10px] font-bold text-blue-600 flex-shrink-0">用途:</span>
                  <span className="text-[10px] text-slate-500">{f.role}</span>
                </div>
                <div className="flex items-start gap-2 ml-10 mt-0.5">
                  <span className="text-[10px] font-bold text-emerald-600 flex-shrink-0">使用:</span>
                  <span className="text-[10px] text-slate-400 leading-relaxed">{f.modules}</span>
                </div>
              </div>
            ))}
            <div className="bg-slate-50 rounded-lg p-3 mt-2">
              <p className="text-[11px] text-slate-500">
                <span className="font-bold text-slate-600">※ 未使用:</span> font-thin(100), font-extralight(200), font-light(300) — 本アプリでは使用していません
              </p>
            </div>
          </div>
        </Section>

        <Section title="13. フォントファミリー">
          <div className="space-y-4">
            {[
              { label: "font-sans（デフォルト）", code: "font-sans", cls: "font-sans", modules: "全モジュール", role: "UIテキスト全般" },
              { label: "font-serif", code: "font-serif", cls: "font-serif", modules: "未使用", role: "（参考表示のみ）" },
              { label: "font-mono", code: "font-mono", cls: "font-mono", modules: "ED-4, CD-1, PM-4, SI-4", role: "契約番号・金額・日付の等幅表示" },
            ].map((f) => (
              <div key={f.code} className="border border-slate-100 rounded-lg p-3">
                <SampleLabel label={f.label} code={f.code} />
                <p className={`text-xl ${f.cls} text-slate-800`}>足場見積システム — ABCabc 0123456789</p>
                <p className={`text-sm ${f.cls} text-slate-500 mt-0.5`}>¥1,234,567 / 2026年3月13日 / 東京都港区南青山1-2-3</p>
                <div className="flex items-center gap-4 mt-1.5">
                  <span className="text-[10px] font-bold text-emerald-600">使用: <span className="font-normal text-slate-400">{f.modules}</span></span>
                  <span className="text-[10px] font-bold text-blue-600">用途: <span className="font-normal text-slate-500">{f.role}</span></span>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="14. 文字装飾・スタイル">
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-bold text-slate-600 mb-3">行間（line-height）</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { label: "詰め", code: "leading-tight", cls: "leading-tight" },
                  { label: "標準", code: "leading-normal", cls: "leading-normal" },
                  { label: "ゆったり", code: "leading-relaxed", cls: "leading-relaxed" },
                ].map((l) => (
                  <div key={l.code} className="bg-slate-50 rounded-lg p-3">
                    <SampleLabel label={l.label} code={l.code} />
                    <p className={`text-sm text-slate-700 ${l.cls}`}>
                      足場工事の見積書を作成しました。ご確認の上、ご不明点がございましたらお気軽にお問い合わせください。
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-600 mb-3">字間（letter-spacing）</h4>
              <div className="flex flex-col gap-2">
                {[
                  { label: "詰め", code: "tracking-tighter" },
                  { label: "やや詰め", code: "tracking-tight" },
                  { label: "標準", code: "tracking-normal" },
                  { label: "やや広め", code: "tracking-wide" },
                  { label: "広め", code: "tracking-wider" },
                  { label: "最も広い", code: "tracking-widest" },
                ].map((t) => (
                  <div key={t.code} className="flex items-center gap-4">
                    <SampleLabel label={t.label} code={t.code} />
                    <span className={`text-base text-slate-800 ${t.code}`}>足場見積システム ASHIBA</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-600 mb-3">テキスト装飾</h4>
              <div className="flex items-center gap-6 flex-wrap">
                {[
                  { label: "下線", code: "underline", cls: "underline" },
                  { label: "取消線", code: "line-through", cls: "line-through" },
                  { label: "上線", code: "overline", cls: "overline" },
                  { label: "下線+装飾", code: "underline decoration-blue-500 decoration-2", cls: "underline decoration-blue-500 decoration-2" },
                  { label: "波線", code: "underline decoration-wavy decoration-red-400", cls: "underline decoration-wavy decoration-red-400" },
                  { label: "点線", code: "underline decoration-dotted", cls: "underline decoration-dotted" },
                  { label: "破線", code: "underline decoration-dashed", cls: "underline decoration-dashed" },
                ].map((d) => (
                  <div key={d.label} className="text-center">
                    <SampleLabel label={d.label} code={d.code} />
                    <span className={`text-base text-slate-800 ${d.cls}`}>サンプルテキスト</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-600 mb-3">テキスト変換・その他</h4>
              <div className="flex items-center gap-6 flex-wrap">
                {[
                  { label: "大文字", code: "uppercase", cls: "uppercase" },
                  { label: "小文字", code: "lowercase", cls: "lowercase" },
                  { label: "先頭大文字", code: "capitalize", cls: "capitalize" },
                  { label: "斜体", code: "italic", cls: "italic" },
                  { label: "等幅数字", code: "tabular-nums", cls: "tabular-nums" },
                ].map((t) => (
                  <div key={t.label} className="text-center">
                    <SampleLabel label={t.label} code={t.code} />
                    <span className={`text-base text-slate-800 ${t.cls}`}>Sample Text 12345</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        <Section title="15. テキストカラー（使用箇所マップ付き）">
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-bold text-slate-600 mb-3">スレート系（見出し〜本文〜補足）</h4>
              <div className="flex flex-col gap-1.5">
                {[
                  { code: "text-slate-900", label: "見出し（最も濃い）", modules: "SG-1, 印刷レイアウト" },
                  { code: "text-slate-800", label: "見出し・強調", modules: "SO-1, PL-2〜7, CD-1, ED-1, MM-1, IL-1, PM-1" },
                  { code: "text-slate-700", label: "本文", modules: "SO-3〜5, CD-3, PL-5〜6, ED-8, WA-3〜4, MM-3〜11" },
                  { code: "text-slate-600", label: "サブテキスト", modules: "SO-2, CD-2, PL-4, SG-2〜6, WA-1, IL-3〜5" },
                  { code: "text-slate-500", label: "補足・ラベル", modules: "SO-1, PL-3, ED-4, NE-2, SG-6, MM-2, IL-2, PM-3" },
                  { code: "text-slate-400", label: "プレースホルダー", modules: "SO-4, ED-10, NF-3, ST-3" },
                  { code: "text-slate-300", label: "無効テキスト", modules: "WA-5（凡例）" },
                ].map((c) => (
                  <div key={c.code} className="flex items-center gap-3">
                    <SampleLabel label="" code={c.code} />
                    <span className={`text-sm font-medium ${c.code} flex-shrink-0`}>足場見積システム</span>
                    <span className="text-[10px] text-slate-400">— {c.label}</span>
                    <span className="text-[10px] font-bold text-emerald-600 ml-auto flex-shrink-0">{c.modules}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-600 mb-3">カラーテキスト（用途別）</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { code: "text-blue-600", label: "リンク・アクション", modules: "PL-7, ED-2, SO-2" },
                  { code: "text-red-600", label: "エラー・必須・削除", modules: "ED-5, NE-3, MM-3" },
                  { code: "text-emerald-600", label: "成功・利益・完了", modules: "CD-4, PM-2, IL-4" },
                  { code: "text-amber-600", label: "警告・進行中", modules: "WA-2, IL-3, ET-1" },
                  { code: "text-violet-600", label: "特殊ステータス", modules: "PL-5" },
                  { code: "text-pink-600", label: "（予備）", modules: "—" },
                  { code: "text-cyan-600", label: "情報バッジ", modules: "SG-6" },
                  { code: "text-orange-600", label: "注意・期限", modules: "IL-3, ET-1" },
                ].map((c) => (
                  <div key={c.code} className="border border-slate-100 rounded-lg p-2.5 text-center">
                    <span className={`text-base font-bold ${c.code}`}>¥1,234,567</span>
                    <SampleLabel label="" code={c.code} />
                    <p className="text-[10px] text-slate-500 mt-0.5">{c.label}</p>
                    <p className="text-[9px] text-emerald-600 font-bold mt-0.5">{c.modules}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        <Section title="16. フォント組み合わせ（実ページ再現パターン）">
          <div className="space-y-6">
            <div className="bg-slate-50 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <h4 className="text-xs font-bold text-slate-500">パターン A: 商談カード</h4>
                <span className="px-1.5 py-0.5 text-[9px] font-black bg-red-500 text-white rounded">PL-7</span>
                <span className="px-1.5 py-0.5 text-[9px] font-black bg-red-500 text-white rounded">SO-1</span>
              </div>
              <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-1.5">
                <p className="text-sm font-extrabold text-slate-800">株式会社サンプル建設</p>
                <p className="text-xs font-bold text-slate-500">契約番号: <span className="font-mono tabular-nums text-slate-700">CTR-2603-001</span></p>
                <p className="text-xs text-slate-500">契約金額: <span className="font-black text-base tabular-nums text-slate-800">¥1,234,567</span></p>
                <p className="text-[11px] text-slate-400">更新日: 2026/03/13</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <h4 className="text-xs font-bold text-slate-500">パターン B: ページタイトル + サマリー</h4>
                <span className="px-1.5 py-0.5 text-[9px] font-black bg-red-500 text-white rounded">IL-1</span>
                <span className="px-1.5 py-0.5 text-[9px] font-black bg-red-500 text-white rounded">IL-4</span>
                <span className="px-1.5 py-0.5 text-[9px] font-black bg-red-500 text-white rounded">PM-2</span>
              </div>
              <div className="bg-white rounded-lg border border-slate-200 p-5">
                <h2 className="text-2xl font-bold text-slate-800">請求管理</h2>
                <div className="flex gap-6 mt-3">
                  <div>
                    <p className="text-xs font-medium text-slate-500">請求合計</p>
                    <p className="text-lg font-bold tabular-nums text-slate-800">¥12,345,678</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500">入金済</p>
                    <p className="text-lg font-bold tabular-nums text-emerald-600">¥8,200,000</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500">未入金</p>
                    <p className="text-lg font-bold tabular-nums text-red-600">¥4,145,678</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <h4 className="text-xs font-bold text-slate-500">パターン C: テーブル（外注費管理）</h4>
                <span className="px-1.5 py-0.5 text-[9px] font-black bg-red-500 text-white rounded">SI-4</span>
                <span className="px-1.5 py-0.5 text-[9px] font-black bg-red-500 text-white rounded">MM-3</span>
              </div>
              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <div className="grid grid-cols-4 bg-slate-50 border-b border-slate-200">
                  <div className="px-4 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider">取引先名</div>
                  <div className="px-4 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider">金額</div>
                  <div className="px-4 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider">ステータス</div>
                  <div className="px-4 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider">支払日</div>
                </div>
                {[
                  { name: "鳶職人 山田組", amount: "¥2,450,000", status: "未払", statusCls: "bg-amber-100 text-amber-700", date: "2026/03/31" },
                  { name: "足場レンタル 佐藤商会", amount: "¥5,800,000", status: "支払済", statusCls: "bg-emerald-100 text-emerald-700", date: "2026/03/15" },
                  { name: "安全設備 鈴木工業", amount: "¥1,200,000", status: "未払", statusCls: "bg-amber-100 text-amber-700", date: "2026/03/31" },
                ].map((r) => (
                  <div key={r.name} className="grid grid-cols-4 border-b border-slate-100 last:border-0">
                    <div className="px-4 py-3 text-sm font-semibold text-slate-800">{r.name}</div>
                    <div className="px-4 py-3 text-sm font-mono tabular-nums text-slate-700">{r.amount}</div>
                    <div className="px-4 py-3"><span className={`px-2 py-0.5 text-[11px] font-bold rounded-full ${r.statusCls}`}>{r.status}</span></div>
                    <div className="px-4 py-3 text-sm tabular-nums text-slate-500">{r.date}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <h4 className="text-xs font-bold text-slate-500">パターン D: 人員配置カード</h4>
                <span className="px-1.5 py-0.5 text-[9px] font-black bg-red-500 text-white rounded">WA-3</span>
                <span className="px-1.5 py-0.5 text-[9px] font-black bg-red-500 text-white rounded">WA-4</span>
              </div>
              <div className="bg-white rounded-lg border border-slate-200 p-4 max-w-sm">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-extrabold text-emerald-700">山</span>
                  <div>
                    <p className="text-sm font-bold text-slate-800">山田 太郎</p>
                    <p className="text-[11px] text-slate-500">職長 / 大型免許</p>
                  </div>
                  <span className="ml-auto px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-700">社員</span>
                </div>
                <div className="border-t border-slate-100 pt-2 mt-2">
                  <p className="text-xs text-slate-600">港区マンション改修 <span className="text-slate-400">3/10〜3/25</span></p>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <h4 className="text-xs font-bold text-slate-500">パターン E: 見積セクション</h4>
                <span className="px-1.5 py-0.5 text-[9px] font-black bg-red-500 text-white rounded">ED-8</span>
                <span className="px-1.5 py-0.5 text-[9px] font-black bg-red-500 text-white rounded">ED-9</span>
              </div>
              <div className="bg-white rounded-lg border border-slate-200 p-4 max-w-lg">
                <h3 className="text-sm font-bold text-slate-800 mb-2">足場仮設工事</h3>
                <div className="space-y-1">
                  {[
                    { item: "くさび式足場 組立", qty: "450", unit: "m²", price: "1,200", total: "540,000" },
                    { item: "メッシュシート", qty: "450", unit: "m²", price: "300", total: "135,000" },
                    { item: "運搬・諸経費", qty: "1", unit: "式", price: "80,000", total: "80,000" },
                  ].map((r) => (
                    <div key={r.item} className="grid grid-cols-[1fr_60px_40px_70px_80px] gap-1 text-xs">
                      <span className="text-slate-700">{r.item}</span>
                      <span className="text-right tabular-nums text-slate-600">{r.qty}</span>
                      <span className="text-center text-slate-500">{r.unit}</span>
                      <span className="text-right tabular-nums text-slate-600">¥{r.price}</span>
                      <span className="text-right font-bold tabular-nums text-slate-800">¥{r.total}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-slate-200 mt-2 pt-2 flex justify-end">
                  <div className="text-right">
                    <p className="text-xs text-slate-500">小計: <span className="font-mono tabular-nums">¥755,000</span></p>
                    <p className="text-xs text-slate-500">消費税: <span className="font-mono tabular-nums">¥75,500</span></p>
                    <p className="text-sm font-bold text-slate-800 mt-1">合計: <span className="font-mono tabular-nums">¥830,500</span></p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Section>

      </div>
    </div>
  )
}
