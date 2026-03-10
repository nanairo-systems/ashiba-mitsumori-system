"use client"

import { useState, useEffect, useCallback } from "react"
import { Palette, Plus, Trash2, Copy, Check, Save, X, ChevronDown, ChevronUp } from "lucide-react"
import { toast } from "sonner"

// ========================================
// プリセットカラー（Tailwind CSS 全色相 × 11段階）
// ========================================
interface PresetColor {
  id: string       // 例: "red-500"
  hex: string      // 例: "#ef4444"
  nameJa: string   // 例: "赤 500"
}

const COLOR_SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const

const TAILWIND_HUES: { name: string; nameJa: string; shades: Record<number, string> }[] = [
  {
    name: "slate", nameJa: "スレート",
    shades: { 50: "#f8fafc", 100: "#f1f5f9", 200: "#e2e8f0", 300: "#cbd5e1", 400: "#94a3b8", 500: "#64748b", 600: "#475569", 700: "#334155", 800: "#1e293b", 900: "#0f172a", 950: "#020617" },
  },
  {
    name: "gray", nameJa: "グレー",
    shades: { 50: "#f9fafb", 100: "#f3f4f6", 200: "#e5e7eb", 300: "#d1d5db", 400: "#9ca3af", 500: "#6b7280", 600: "#4b5563", 700: "#374151", 800: "#1f2937", 900: "#111827", 950: "#030712" },
  },
  {
    name: "red", nameJa: "赤",
    shades: { 50: "#fef2f2", 100: "#fee2e2", 200: "#fecaca", 300: "#fca5a5", 400: "#f87171", 500: "#ef4444", 600: "#dc2626", 700: "#b91c1c", 800: "#991b1b", 900: "#7f1d1d", 950: "#450a0a" },
  },
  {
    name: "orange", nameJa: "オレンジ",
    shades: { 50: "#fff7ed", 100: "#ffedd5", 200: "#fed7aa", 300: "#fdba74", 400: "#fb923c", 500: "#f97316", 600: "#ea580c", 700: "#c2410c", 800: "#9a3412", 900: "#7c2d12", 950: "#431407" },
  },
  {
    name: "amber", nameJa: "アンバー",
    shades: { 50: "#fffbeb", 100: "#fef3c7", 200: "#fde68a", 300: "#fcd34d", 400: "#fbbf24", 500: "#f59e0b", 600: "#d97706", 700: "#b45309", 800: "#92400e", 900: "#78350f", 950: "#451a03" },
  },
  {
    name: "yellow", nameJa: "イエロー",
    shades: { 50: "#fefce8", 100: "#fef9c3", 200: "#fef08a", 300: "#fde047", 400: "#facc15", 500: "#eab308", 600: "#ca8a04", 700: "#a16207", 800: "#854d0e", 900: "#713f12", 950: "#422006" },
  },
  {
    name: "lime", nameJa: "ライム",
    shades: { 50: "#f7fee7", 100: "#ecfccb", 200: "#d9f99d", 300: "#bef264", 400: "#a3e635", 500: "#84cc16", 600: "#65a30d", 700: "#4d7c0f", 800: "#3f6212", 900: "#365314", 950: "#1a2e05" },
  },
  {
    name: "green", nameJa: "グリーン",
    shades: { 50: "#f0fdf4", 100: "#dcfce7", 200: "#bbf7d0", 300: "#86efac", 400: "#4ade80", 500: "#22c55e", 600: "#16a34a", 700: "#15803d", 800: "#166534", 900: "#14532d", 950: "#052e16" },
  },
  {
    name: "emerald", nameJa: "エメラルド",
    shades: { 50: "#ecfdf5", 100: "#d1fae5", 200: "#a7f3d0", 300: "#6ee7b7", 400: "#34d399", 500: "#10b981", 600: "#059669", 700: "#047857", 800: "#065f46", 900: "#064e3b", 950: "#022c22" },
  },
  {
    name: "teal", nameJa: "ティール",
    shades: { 50: "#f0fdfa", 100: "#ccfbf1", 200: "#99f6e4", 300: "#5eead4", 400: "#2dd4bf", 500: "#14b8a6", 600: "#0d9488", 700: "#0f766e", 800: "#115e59", 900: "#134e4a", 950: "#042f2e" },
  },
  {
    name: "cyan", nameJa: "シアン",
    shades: { 50: "#ecfeff", 100: "#cffafe", 200: "#a5f3fc", 300: "#67e8f9", 400: "#22d3ee", 500: "#06b6d4", 600: "#0891b2", 700: "#0e7490", 800: "#155e75", 900: "#164e63", 950: "#083344" },
  },
  {
    name: "sky", nameJa: "スカイ",
    shades: { 50: "#f0f9ff", 100: "#e0f2fe", 200: "#bae6fd", 300: "#7dd3fc", 400: "#38bdf8", 500: "#0ea5e9", 600: "#0284c7", 700: "#0369a1", 800: "#075985", 900: "#0c4a6e", 950: "#082f49" },
  },
  {
    name: "blue", nameJa: "ブルー",
    shades: { 50: "#eff6ff", 100: "#dbeafe", 200: "#bfdbfe", 300: "#93c5fd", 400: "#60a5fa", 500: "#3b82f6", 600: "#2563eb", 700: "#1d4ed8", 800: "#1e40af", 900: "#1e3a8a", 950: "#172554" },
  },
  {
    name: "indigo", nameJa: "インディゴ",
    shades: { 50: "#eef2ff", 100: "#e0e7ff", 200: "#c7d2fe", 300: "#a5b4fc", 400: "#818cf8", 500: "#6366f1", 600: "#4f46e5", 700: "#4338ca", 800: "#3730a3", 900: "#312e81", 950: "#1e1b4b" },
  },
  {
    name: "violet", nameJa: "バイオレット",
    shades: { 50: "#f5f3ff", 100: "#ede9fe", 200: "#ddd6fe", 300: "#c4b5fd", 400: "#a78bfa", 500: "#8b5cf6", 600: "#7c3aed", 700: "#6d28d9", 800: "#5b21b6", 900: "#4c1d95", 950: "#2e1065" },
  },
  {
    name: "purple", nameJa: "パープル",
    shades: { 50: "#faf5ff", 100: "#f3e8ff", 200: "#e9d5ff", 300: "#d8b4fe", 400: "#c084fc", 500: "#a855f7", 600: "#9333ea", 700: "#7e22ce", 800: "#6b21a8", 900: "#581c87", 950: "#3b0764" },
  },
  {
    name: "fuchsia", nameJa: "フューシャ",
    shades: { 50: "#fdf4ff", 100: "#fae8ff", 200: "#f5d0fe", 300: "#f0abfc", 400: "#e879f9", 500: "#d946ef", 600: "#c026d3", 700: "#a21caf", 800: "#86198f", 900: "#701a75", 950: "#4a044e" },
  },
  {
    name: "pink", nameJa: "ピンク",
    shades: { 50: "#fdf2f8", 100: "#fce7f3", 200: "#fbcfe8", 300: "#f9a8d4", 400: "#f472b6", 500: "#ec4899", 600: "#db2777", 700: "#be185d", 800: "#9d174d", 900: "#831843", 950: "#500724" },
  },
  {
    name: "rose", nameJa: "ローズ",
    shades: { 50: "#fff1f2", 100: "#ffe4e6", 200: "#fecdd3", 300: "#fda4af", 400: "#fb7185", 500: "#f43f5e", 600: "#e11d48", 700: "#be123c", 800: "#9f1239", 900: "#881337", 950: "#4c0519" },
  },
]

// プリセット一覧生成
function generatePresets(): PresetColor[] {
  const presets: PresetColor[] = []
  for (const hue of TAILWIND_HUES) {
    for (const shade of COLOR_SHADES) {
      presets.push({
        id: `${hue.name}-${shade}`,
        hex: hue.shades[shade],
        nameJa: `${hue.nameJa} ${shade}`,
      })
    }
  }
  return presets
}

const PRESETS = generatePresets()

// ========================================
// カスタムカラー（localStorageに保存）
// ========================================
interface CustomColor {
  id: string
  hex: string
  label: string
  createdAt: string
}

const STORAGE_KEY = "ashiba-color-palette-custom"

function loadCustomColors(): CustomColor[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveCustomColors(colors: CustomColor[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(colors))
}

// ========================================
// ユーティリティ
// ========================================
function getContrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.55 ? "#1e293b" : "#ffffff"
}

// ========================================
// メインコンポーネント
// ========================================
export function ColorPalettePage() {
  const [customColors, setCustomColors] = useState<CustomColor[]>([])
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newHex, setNewHex] = useState("#3b82f6")
  const [newLabel, setNewLabel] = useState("")
  const [collapsedHues, setCollapsedHues] = useState<Set<string>>(new Set())

  useEffect(() => {
    setCustomColors(loadCustomColors())
  }, [])

  const handleCopy = useCallback((id: string, hex: string, label: string) => {
    const text = `${label}（${hex}）`
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    toast.success(`コピーしました: ${text}`)
    setTimeout(() => setCopiedId(null), 2000)
  }, [])

  function handleAddCustom() {
    if (!newHex.match(/^#[0-9a-fA-F]{6}$/)) {
      toast.error("正しいHEXカラーを入力してください（例: #ff6600）")
      return
    }
    const label = newLabel.trim() || newHex
    const color: CustomColor = {
      id: `custom-${Date.now()}`,
      hex: newHex.toLowerCase(),
      label,
      createdAt: new Date().toISOString(),
    }
    const updated = [color, ...customColors]
    setCustomColors(updated)
    saveCustomColors(updated)
    setNewHex("#3b82f6")
    setNewLabel("")
    setShowAddForm(false)
    toast.success(`「${label}」を登録しました`)
  }

  function handleDeleteCustom(id: string) {
    const updated = customColors.filter((c) => c.id !== id)
    setCustomColors(updated)
    saveCustomColors(updated)
    toast.success("削除しました")
  }

  function toggleHue(hueName: string) {
    setCollapsedHues((prev) => {
      const next = new Set(prev)
      if (next.has(hueName)) next.delete(hueName)
      else next.add(hueName)
      return next
    })
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* ヘッダー */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Palette className="w-5 h-5 text-violet-500" />
              カラーパレット
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              色を番号・名前で指示できます。クリックで色名とHEXをコピー
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 px-4 py-2 bg-violet-500 text-white rounded-lg text-sm font-medium hover:bg-violet-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            カスタム色を登録
          </button>
        </div>
      </div>

      <div className="flex-1 px-6 py-4 space-y-6">
        {/* カスタム色登録フォーム */}
        {showAddForm && (
          <div className="bg-white rounded-xl border border-violet-200 p-5">
            <h3 className="text-sm font-bold text-violet-700 mb-3 flex items-center gap-2">
              <Plus className="w-4 h-4" />
              カスタム色を登録
            </h3>
            <div className="flex items-end gap-4 flex-wrap">
              <div>
                <label className="text-xs text-slate-500 block mb-1">カラーピッカー</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={newHex}
                    onChange={(e) => setNewHex(e.target.value)}
                    className="w-14 h-14 rounded-lg border border-slate-200 cursor-pointer"
                  />
                  <div
                    className="w-14 h-14 rounded-lg border-2 border-slate-200 shadow-inner"
                    style={{ backgroundColor: newHex }}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">HEXコード</label>
                <input
                  type="text"
                  value={newHex}
                  onChange={(e) => setNewHex(e.target.value)}
                  placeholder="#ff6600"
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono w-32 focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs text-slate-500 block mb-1">名前（日本語OK）</label>
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="例: 会社ブランドの青、ヘッダー背景色 など"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddCustom}
                  className="flex items-center gap-1.5 px-4 py-2 bg-violet-500 text-white rounded-lg text-sm font-medium hover:bg-violet-600 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  登録
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm hover:bg-slate-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* カスタム登録色 */}
        {customColors.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Save className="w-4 h-4 text-violet-500" />
              登録済みカスタム色（{customColors.length}色）
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {customColors.map((c) => (
                <div key={c.id} className="group relative">
                  <button
                    onClick={() => handleCopy(c.id, c.hex, c.label)}
                    className="w-full rounded-xl border-2 border-slate-200 overflow-hidden hover:border-violet-400 hover:shadow-lg transition-all"
                  >
                    <div
                      className="h-20 flex items-center justify-center"
                      style={{ backgroundColor: c.hex }}
                    >
                      {copiedId === c.id ? (
                        <Check className="w-6 h-6" style={{ color: getContrastColor(c.hex) }} />
                      ) : (
                        <Copy className="w-5 h-5 opacity-0 group-hover:opacity-60 transition-opacity" style={{ color: getContrastColor(c.hex) }} />
                      )}
                    </div>
                    <div className="px-2 py-2 bg-white text-left">
                      <p className="text-xs font-bold text-slate-700 truncate">{c.label}</p>
                      <p className="text-[10px] font-mono text-slate-400">{c.hex}</p>
                    </div>
                  </button>
                  <button
                    onClick={() => handleDeleteCustom(c.id)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/80 border border-slate-200 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:border-red-200"
                  >
                    <Trash2 className="w-3 h-3 text-red-500" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 使い方ガイド */}
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
          <h3 className="text-sm font-bold text-violet-700 mb-2">使い方</h3>
          <ul className="text-xs text-slate-600 space-y-1 leading-relaxed">
            <li>・色のマスをクリックすると <b>色名（HEXコード）</b> がコピーされます</li>
            <li>・色を指示する時は <b>「赤 500」「ブルー 700」</b> のように <b>色名 + 番号</b> で伝えてください</li>
            <li>・番号が小さいほど薄く（50が最も薄い）、大きいほど濃くなります（950が最も濃い）</li>
            <li>・<b>500</b> が標準の色、<b>50〜200</b> が淡い色、<b>700〜950</b> が濃い色です</li>
            <li>・カスタム色は「カスタム色を登録」ボタンから自由に追加できます（ブラウザに保存）</li>
          </ul>
        </div>

        {/* Tailwindプリセット色一覧 */}
        <div className="space-y-3">
          <h2 className="text-base font-bold text-slate-800">Tailwind CSS カラーパレット（{TAILWIND_HUES.length}色相 × {COLOR_SHADES.length}段階）</h2>

          {TAILWIND_HUES.map((hue) => {
            const isCollapsed = collapsedHues.has(hue.name)
            return (
              <div key={hue.name} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <button
                  onClick={() => toggleHue(hue.name)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg border border-slate-200"
                      style={{ backgroundColor: hue.shades[500] }}
                    />
                    <div className="text-left">
                      <span className="text-sm font-bold text-slate-800">{hue.nameJa}</span>
                      <span className="text-xs text-slate-400 ml-2">{hue.name}</span>
                    </div>
                  </div>
                  {isCollapsed ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
                </button>

                {!isCollapsed && (
                  <div className="px-4 pb-4">
                    <div className="grid grid-cols-11 gap-2">
                      {COLOR_SHADES.map((shade) => {
                        const hex = hue.shades[shade]
                        const id = `${hue.name}-${shade}`
                        const label = `${hue.nameJa} ${shade}`
                        const contrast = getContrastColor(hex)
                        return (
                          <button
                            key={shade}
                            onClick={() => handleCopy(id, hex, label)}
                            className="group rounded-xl border-2 border-slate-200 overflow-hidden hover:border-violet-400 hover:shadow-lg hover:scale-105 transition-all"
                            title={`${label}（${hex}）`}
                          >
                            <div
                              className="h-16 flex items-center justify-center relative"
                              style={{ backgroundColor: hex }}
                            >
                              {copiedId === id ? (
                                <Check className="w-5 h-5" style={{ color: contrast }} />
                              ) : (
                                <Copy className="w-4 h-4 opacity-0 group-hover:opacity-50 transition-opacity" style={{ color: contrast }} />
                              )}
                            </div>
                            <div className="px-1 py-1.5 bg-white text-center">
                              <p className="text-[11px] font-bold text-slate-700">{shade}</p>
                              <p className="text-[9px] font-mono text-slate-400">{hex}</p>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
