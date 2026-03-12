/**
 * [COMPONENT] 音声サンプルプレーヤー
 *
 * Web Speech API を使って日本語女性ボイスを試聴するUI
 * - ブラウザ内蔵の音声合成エンジンを使用
 * - 番号キー(1〜6)で再生対応
 * - 作業内容報告のサンプル会話付き
 */
"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Volume2, VolumeX, Check, Play, Square, FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import { buildWorkReportText, type WorkReportData } from "@/hooks/use-voice-notification"

/** 音声プリセット定義 */
interface VoicePreset {
  id: number
  label: string
  description: string
  /** pitch: 0.1〜2.0 (1.0=標準) */
  pitch: number
  /** rate: 0.1〜2.0 (1.0=標準) */
  rate: number
  /** voiceNameKeyword: ブラウザの音声名に含まれるキーワード（マッチ優先度順） */
  voiceKeywords: string[]
  /** サンプル会話テキスト */
  sampleTexts: string[]
}

const VOICE_PRESETS: VoicePreset[] = [
  {
    id: 1,
    label: "ナチュラル",
    description: "落ち着いた自然な女性の声。標準的な速度で聞き取りやすい",
    pitch: 1.1,
    rate: 1.0,
    voiceKeywords: ["Kyoko", "Google 日本語", "O-Ren", "Hattori"],
    sampleTexts: [
      "お疲れ様です。本日の作業内容を報告します。",
      "現場名、渡辺ビル新築工事。組立作業が完了しました。作業員5名、車両2台で実施。特記事項はありません。",
      "明日の予定です。同現場にて2階部分の足場組立を行います。",
    ],
  },
  {
    id: 2,
    label: "はきはき",
    description: "明るくテキパキした声。通知に最適",
    pitch: 1.3,
    rate: 1.15,
    voiceKeywords: ["Kyoko", "Google 日本語", "O-Ren", "Hattori"],
    sampleTexts: [
      "お知らせします。新しい工程が登録されました。",
      "現場名、山田邸リフォーム。解体作業、3月15日から3月17日、3日間の予定です。担当班、第1班、職長、田中太郎。",
      "確認をお願いします。",
    ],
  },
  {
    id: 3,
    label: "やさしい",
    description: "柔らかく穏やかな声。長文の報告に向いている",
    pitch: 1.2,
    rate: 0.9,
    voiceKeywords: ["Kyoko", "Google 日本語", "O-Ren", "Hattori"],
    sampleTexts: [
      "本日の作業報告をお伝えします。",
      "渡辺ビル新築工事、組立作業は順調に進んでいます。進捗率は約70パーセントです。明日で完了の見込みです。",
      "なお、車検が近い車両が1台あります。ご確認ください。",
    ],
  },
  {
    id: 4,
    label: "アナウンサー",
    description: "ニュースキャスターのような明瞭な声。重要通知向け",
    pitch: 1.0,
    rate: 1.05,
    voiceKeywords: ["Kyoko", "Google 日本語", "O-Ren", "Hattori"],
    sampleTexts: [
      "重要なお知らせです。",
      "未配置の職人が3名います。佐藤一郎、鈴木健太、グエン・ヴァン・ミン。3月12日の現場に配置が必要です。",
      "人員配置画面から対応をお願いいたします。",
    ],
  },
  {
    id: 5,
    label: "かわいい",
    description: "高めの可愛らしい声。カジュアルな通知向け",
    pitch: 1.5,
    rate: 1.1,
    voiceKeywords: ["Kyoko", "Google 日本語", "O-Ren", "Hattori"],
    sampleTexts: [
      "こんにちは。今日の予定をお知らせしますね。",
      "第2班は、佐藤邸の解体工事です。作業員は4名。お昼までに1階部分を完了させましょう。",
      "頑張ってください。応援しています。",
    ],
  },
  {
    id: 6,
    label: "クール",
    description: "低めの落ち着いたプロフェッショナルな声",
    pitch: 0.9,
    rate: 0.95,
    voiceKeywords: ["Kyoko", "Google 日本語", "O-Ren", "Hattori"],
    sampleTexts: [
      "日報を確認しました。",
      "本日完了した工程。渡辺ビル3階組立、山田邸1階解体。明日の予定工程、2件。未配置の警告、なし。",
      "以上です。",
    ],
  },
]

/** 作業報告デモデータ */
const WORK_REPORT_DEMOS: { title: string; data: WorkReportData }[] = [
  {
    title: "組立作業 完了報告",
    data: {
      siteName: "渡辺ビル新築工事",
      workType: "ASSEMBLY",
      workerCount: 5,
      foremanName: "田中太郎",
      vehicleCount: 2,
      teamName: "第1班",
      date: "2026-03-12",
      isCompleted: true,
    },
  },
  {
    title: "解体作業 進捗報告",
    data: {
      siteName: "山田邸リフォーム",
      workType: "DISASSEMBLY",
      workerCount: 4,
      foremanName: "佐藤一郎",
      vehicleCount: 1,
      teamName: "第2班",
      date: "2026-03-13",
      notes: "2階部分は明日に持ち越し",
      isCompleted: false,
    },
  },
  {
    title: "外注作業 完了報告（詳細あり）",
    data: {
      siteName: "鈴木マンション大規模修繕",
      workType: "SUBCONTRACT",
      workerCount: 8,
      foremanName: "グエン・ヴァン・ミン",
      vehicleCount: 3,
      teamName: "協力第1班",
      date: "2026-03-12",
      notes: "予定通り完了。次回は3月18日から北面の施工に入ります",
      isCompleted: true,
    },
  },
]

/** ブラウザから日本語女性ボイスを取得 */
function getJapaneseVoice(keywords: string[]): SpeechSynthesisVoice | null {
  const voices = speechSynthesis.getVoices()
  const jaVoices = voices.filter((v) => v.lang.startsWith("ja"))

  // キーワードでマッチを試みる
  for (const kw of keywords) {
    const match = jaVoices.find((v) => v.name.includes(kw))
    if (match) return match
  }

  // 女性っぽい名前を探す
  const femaleHints = ["female", "woman", "Kyoko", "Haruka", "Nanami", "O-Ren"]
  for (const hint of femaleHints) {
    const match = jaVoices.find((v) => v.name.toLowerCase().includes(hint.toLowerCase()))
    if (match) return match
  }

  // 日本語ボイスの最初のものを返す
  return jaVoices[0] ?? null
}

export function VoiceSamplePlayer() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [playingId, setPlayingId] = useState<number | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [volume, setVolume] = useState(0.8)
  const [supported, setSupported] = useState(true)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  // 音声リストの読み込み
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setSupported(false)
      return
    }

    function loadVoices() {
      const v = speechSynthesis.getVoices()
      setVoices(v)
    }

    loadVoices()
    speechSynthesis.addEventListener("voiceschanged", loadVoices)
    return () => speechSynthesis.removeEventListener("voiceschanged", loadVoices)
  }, [])

  // localStorage から選択済みボイスを復元
  useEffect(() => {
    const saved = localStorage.getItem("voice-preset-id")
    if (saved) setSelectedId(Number(saved))
  }, [])

  const stopSpeaking = useCallback(() => {
    speechSynthesis.cancel()
    setPlayingId(null)
    utteranceRef.current = null
  }, [])

  const speak = useCallback((preset: VoicePreset) => {
    if (!supported) return
    stopSpeaking()

    setPlayingId(preset.id)

    const fullText = preset.sampleTexts.join(" ")
    const voice = getJapaneseVoice(preset.voiceKeywords)

    const utt = new SpeechSynthesisUtterance(fullText)
    utt.lang = "ja-JP"
    utt.pitch = preset.pitch
    utt.rate = preset.rate
    utt.volume = volume
    if (voice) utt.voice = voice

    utt.onend = () => setPlayingId(null)
    utt.onerror = () => setPlayingId(null)

    utteranceRef.current = utt
    speechSynthesis.speak(utt)
  }, [supported, volume, stopSpeaking])

  // 番号キーで再生
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // テキスト入力中は無効
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      const num = parseInt(e.key)
      if (num >= 1 && num <= VOICE_PRESETS.length) {
        e.preventDefault()
        const preset = VOICE_PRESETS[num - 1]
        if (playingId === preset.id) {
          stopSpeaking()
        } else {
          speak(preset)
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [speak, playingId, stopSpeaking])

  // ページ離脱時に停止
  useEffect(() => {
    return () => { speechSynthesis.cancel() }
  }, [])

  function selectVoice(presetId: number) {
    setSelectedId(presetId)
    localStorage.setItem("voice-preset-id", String(presetId))
  }

  const jaVoiceCount = voices.filter((v) => v.lang.startsWith("ja")).length

  if (!supported) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
        このブラウザは音声合成に対応していません。Chrome または Safari をお使いください。
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ボリューム調整 */}
      <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3">
        <VolumeX className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <input
          type="range"
          min={0}
          max={1}
          step={0.1}
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="flex-1 accent-blue-500"
        />
        <Volume2 className="w-4 h-4 text-slate-600 flex-shrink-0" />
        <span className="text-xs text-slate-500 w-10 text-right">{Math.round(volume * 100)}%</span>
      </div>

      {/* 利用可能ボイス情報 */}
      <div className="text-xs text-slate-400">
        利用可能な日本語ボイス: {jaVoiceCount}件
        {jaVoiceCount === 0 && " (読み込み中...)"}
      </div>

      {/* ボイスカード一覧 */}
      <div className="grid gap-3">
        {VOICE_PRESETS.map((preset) => {
          const isPlaying = playingId === preset.id
          const isSelected = selectedId === preset.id

          return (
            <div
              key={preset.id}
              className={cn(
                "relative border-2 rounded-lg p-4 transition-all",
                isSelected
                  ? "border-blue-500 bg-blue-50/50 shadow-sm"
                  : "border-slate-200 bg-white hover:border-slate-300"
              )}
            >
              {/* 選択中バッジ */}
              {isSelected && (
                <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500 text-white text-[10px] font-bold">
                  <Check className="w-3 h-3" />
                  選択中
                </div>
              )}

              <div className="flex items-start gap-4">
                {/* 番号 + 再生ボタン */}
                <button
                  onClick={() => isPlaying ? stopSpeaking() : speak(preset)}
                  className={cn(
                    "flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center text-lg font-extrabold transition-all active:scale-95",
                    isPlaying
                      ? "bg-red-500 text-white shadow-md animate-pulse"
                      : "bg-slate-800 text-white hover:bg-slate-700 shadow-sm"
                  )}
                >
                  {isPlaying ? (
                    <Square className="w-5 h-5 fill-current" />
                  ) : (
                    <span className="flex items-center gap-0.5">
                      <span className="text-base">{preset.id}</span>
                    </span>
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  {/* タイトル行 */}
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-bold text-slate-800">
                      {preset.label}
                    </h3>
                    <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                      pitch:{preset.pitch} / rate:{preset.rate}
                    </span>
                  </div>

                  {/* 説明 */}
                  <p className="text-xs text-slate-500 mb-2">{preset.description}</p>

                  {/* サンプル会話 */}
                  <div className="space-y-1 bg-slate-50 rounded-md p-2.5 border border-slate-100">
                    <div className="text-[10px] font-bold text-slate-400 mb-1">SAMPLE</div>
                    {preset.sampleTexts.map((text, i) => (
                      <p key={i} className="text-xs text-slate-600 leading-relaxed">
                        {text}
                      </p>
                    ))}
                  </div>

                  {/* アクションボタン */}
                  <div className="flex items-center gap-2 mt-2.5">
                    <button
                      onClick={() => isPlaying ? stopSpeaking() : speak(preset)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all active:scale-95",
                        isPlaying
                          ? "bg-red-100 text-red-600 hover:bg-red-200"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      )}
                    >
                      {isPlaying ? (
                        <><Square className="w-3 h-3 fill-current" />停止</>
                      ) : (
                        <><Play className="w-3 h-3 fill-current" />再生</>
                      )}
                    </button>

                    <button
                      onClick={() => selectVoice(preset.id)}
                      disabled={isSelected}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all active:scale-95",
                        isSelected
                          ? "bg-blue-100 text-blue-400 cursor-default"
                          : "bg-blue-500 text-white hover:bg-blue-600 shadow-sm"
                      )}
                    >
                      {isSelected ? (
                        <><Check className="w-3 h-3" />選択済み</>
                      ) : (
                        "この声を使う"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* 作業報告デモ */}
      <div className="border-t-2 border-slate-200 pt-4 mt-4">
        <h2 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-500" />
          作業報告デモ（選択中の声で再生）
        </h2>
        <p className="text-xs text-slate-500 mb-3">
          実際の作業完了時に読み上げられる内容のサンプルです。選択したボイスで再生されます。
        </p>
        <div className="grid gap-2">
          {WORK_REPORT_DEMOS.map((demo, i) => {
            const reportText = buildWorkReportText(demo.data)
            const demoPlaying = playingId === 100 + i

            return (
              <div key={i} className="border border-slate-200 rounded-lg p-3 bg-white">
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => {
                      if (demoPlaying) {
                        stopSpeaking()
                      } else {
                        stopSpeaking()
                        setPlayingId(100 + i)
                        const preset = selectedId ? VOICE_PRESETS.find((p) => p.id === selectedId) ?? VOICE_PRESETS[1] : VOICE_PRESETS[1]
                        const voice = getJapaneseVoice(preset.voiceKeywords)
                        const utt = new SpeechSynthesisUtterance(reportText)
                        utt.lang = "ja-JP"
                        utt.pitch = preset.pitch
                        utt.rate = preset.rate
                        utt.volume = volume
                        if (voice) utt.voice = voice
                        utt.onend = () => setPlayingId(null)
                        utt.onerror = () => setPlayingId(null)
                        utteranceRef.current = utt
                        speechSynthesis.speak(utt)
                      }
                    }}
                    className={cn(
                      "flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-all active:scale-95",
                      demoPlaying
                        ? "bg-red-500 text-white animate-pulse"
                        : "bg-blue-500 text-white hover:bg-blue-600"
                    )}
                  >
                    {demoPlaying ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-slate-700 mb-1">{demo.title}</div>
                    <div className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 rounded-md p-2 border border-slate-100">
                      {reportText}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* キーボードショートカット案内 */}
      <div className="text-xs text-slate-400 text-center py-2 border-t border-slate-100 mt-4">
        キーボードの <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-600 font-mono">1</kbd> 〜 <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-600 font-mono">6</kbd> キーでサンプルを再生できます
      </div>
    </div>
  )
}
