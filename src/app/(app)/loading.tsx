export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* ヘッダースケルトン */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-slate-200 rounded" />
          <div className="h-4 w-32 bg-slate-100 rounded" />
        </div>
        <div className="h-9 w-32 bg-slate-200 rounded-lg" />
      </div>

      {/* サマリーカードスケルトン */}
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border p-4 space-y-2">
            <div className="h-3 w-16 bg-slate-100 rounded" />
            <div className="h-6 w-24 bg-slate-200 rounded" />
          </div>
        ))}
      </div>

      {/* コンテンツスケルトン */}
      <div className="bg-white rounded-xl border">
        <div className="border-b px-4 py-3">
          <div className="h-4 w-40 bg-slate-100 rounded" />
        </div>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-slate-50">
            <div className="h-4 w-4 bg-slate-100 rounded" />
            <div className="h-4 flex-1 bg-slate-100 rounded" />
            <div className="h-4 w-20 bg-slate-100 rounded" />
            <div className="h-6 w-16 bg-slate-200 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
