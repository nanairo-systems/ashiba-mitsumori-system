/**
 * [現操-05] 写真添付プレースホルダーセクション
 *
 * 図面・安全書類・その他の写真添付UI（準備中）。
 * 他ページからも再利用可能なモジュール。
 */
"use client"

import { useState } from "react"
import { ImagePlus, Camera } from "lucide-react"
import { cn } from "@/lib/utils"

const PHOTO_TABS = [
  { key: "blueprint", label: "図面" },
  { key: "safety", label: "安全書類" },
  { key: "other", label: "その他" },
] as const

type PhotoTab = typeof PHOTO_TABS[number]["key"]

export function SiteOpsPhotoSection() {
  const [activeTab, setActiveTab] = useState<PhotoTab>("blueprint")

  return (
    <div className="space-y-3">
      {/* セクションヘッダー */}
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
        <Camera className="w-3.5 h-3.5" />
        <span>現操-05 写真添付</span>
      </div>

      {/* タブ切替 */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
        {PHOTO_TABS.map((tab) => (
          <button
            key={tab.key}
            className={cn(
              "flex-1 text-xs font-medium py-1.5 px-2 rounded-md transition-colors",
              activeTab === tab.key
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* プレースホルダー */}
      <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 flex flex-col items-center justify-center gap-2 bg-slate-50/50">
        <ImagePlus className="w-8 h-8 text-slate-300" />
        <p className="text-xs text-slate-400 font-medium">準備中</p>
        <p className="text-[10px] text-slate-300">
          写真のアップロード機能は今後実装予定です
        </p>
      </div>
    </div>
  )
}
