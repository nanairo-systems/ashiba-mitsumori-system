/**
 * [HOOK] 音声通知ユーティリティ
 *
 * Web Speech API を使って作業内容を音声で読み上げる。
 * - VoiceSamplePlayer で選択したプリセットを使用
 * - 作業報告テンプレート付き
 * - どのコンポーネントからでも呼び出し可能
 */
"use client"

import { useCallback, useRef } from "react"

/** プリセット設定 */
interface VoicePresetConfig {
  pitch: number
  rate: number
}

const PRESETS: Record<number, VoicePresetConfig> = {
  1: { pitch: 1.1, rate: 1.0 },   // ナチュラル
  2: { pitch: 1.3, rate: 1.15 },  // はきはき
  3: { pitch: 1.2, rate: 0.9 },   // やさしい
  4: { pitch: 1.0, rate: 1.05 },  // アナウンサー
  5: { pitch: 1.5, rate: 1.1 },   // かわいい
  6: { pitch: 0.9, rate: 0.95 },  // クール
}

/** 作業報告データ */
export interface WorkReportData {
  /** 現場名 */
  siteName: string
  /** 工種（組立・解体など） */
  workType: string
  /** 作業員数 */
  workerCount?: number
  /** 職長名 */
  foremanName?: string
  /** 車両数 */
  vehicleCount?: number
  /** 班名 */
  teamName?: string
  /** 日付 (yyyy-MM-dd) */
  date?: string
  /** 進捗メモ */
  notes?: string
  /** 完了かどうか */
  isCompleted?: boolean
}

/** 日付を読み上げ用に変換 */
function formatDateForSpeech(dateStr: string): string {
  const parts = dateStr.split("-")
  if (parts.length !== 3) return dateStr
  return `${Number(parts[1])}月${Number(parts[2])}日`
}

/** 工種コードを日本語に変換 */
function workTypeToJapanese(code: string): string {
  const map: Record<string, string> = {
    ASSEMBLY: "組立",
    DISASSEMBLY: "解体",
    REWORK: "その他",
    INHOUSE: "自社作業",
    SUBCONTRACT: "外注作業",
  }
  return map[code] ?? code
}

/** 作業報告テキストを生成 */
export function buildWorkReportText(data: WorkReportData): string {
  const parts: string[] = []

  if (data.isCompleted) {
    parts.push("作業完了の報告です。")
  } else {
    parts.push("作業内容を報告します。")
  }

  // 現場名
  parts.push(`現場名、${data.siteName}。`)

  // 工種
  const workTypeLabel = workTypeToJapanese(data.workType)
  if (data.isCompleted) {
    parts.push(`${workTypeLabel}作業が完了しました。`)
  } else {
    parts.push(`${workTypeLabel}作業。`)
  }

  // 日付
  if (data.date) {
    parts.push(`${formatDateForSpeech(data.date)}の作業です。`)
  }

  // 班名
  if (data.teamName) {
    parts.push(`担当、${data.teamName}。`)
  }

  // 職長
  if (data.foremanName) {
    parts.push(`職長、${data.foremanName}。`)
  }

  // 人数
  if (data.workerCount !== undefined && data.workerCount > 0) {
    parts.push(`作業員、${data.workerCount}名。`)
  }

  // 車両
  if (data.vehicleCount !== undefined && data.vehicleCount > 0) {
    parts.push(`車両、${data.vehicleCount}台。`)
  }

  // メモ
  if (data.notes) {
    parts.push(`備考、${data.notes}。`)
  }

  parts.push("以上です。")

  return parts.join("")
}

/** 日本語女性ボイスを取得 */
function getJapaneseVoice(): SpeechSynthesisVoice | null {
  const voices = speechSynthesis.getVoices()
  const jaVoices = voices.filter((v) => v.lang.startsWith("ja"))

  const keywords = ["Kyoko", "Google 日本語", "O-Ren", "Haruka", "Nanami", "Hattori"]
  for (const kw of keywords) {
    const match = jaVoices.find((v) => v.name.includes(kw))
    if (match) return match
  }

  return jaVoices[0] ?? null
}

/** 選択済みプリセットを取得 */
function getSelectedPreset(): VoicePresetConfig {
  if (typeof window === "undefined") return PRESETS[2] // デフォルト: はきはき
  const saved = localStorage.getItem("voice-preset-id")
  const id = saved ? Number(saved) : 2
  return PRESETS[id] ?? PRESETS[2]
}

/**
 * 音声通知フック
 *
 * @example
 * const { speak, speakWorkReport, stop, isSpeaking } = useVoiceNotification()
 *
 * // 自由テキストを読み上げ
 * speak("新しい通知があります")
 *
 * // 作業報告を読み上げ
 * speakWorkReport({
 *   siteName: "渡辺ビル新築工事",
 *   workType: "ASSEMBLY",
 *   workerCount: 5,
 *   foremanName: "田中太郎",
 *   vehicleCount: 2,
 *   teamName: "第1班",
 *   isCompleted: true,
 * })
 */
export function useVoiceNotification() {
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  const stop = useCallback(() => {
    speechSynthesis.cancel()
    utteranceRef.current = null
  }, [])

  const speak = useCallback((text: string, onEnd?: () => void) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return

    stop()

    const preset = getSelectedPreset()
    const voice = getJapaneseVoice()

    const utt = new SpeechSynthesisUtterance(text)
    utt.lang = "ja-JP"
    utt.pitch = preset.pitch
    utt.rate = preset.rate
    utt.volume = 0.8
    if (voice) utt.voice = voice

    utt.onend = () => {
      utteranceRef.current = null
      onEnd?.()
    }
    utt.onerror = () => {
      utteranceRef.current = null
    }

    utteranceRef.current = utt
    speechSynthesis.speak(utt)
  }, [stop])

  const speakWorkReport = useCallback((data: WorkReportData, onEnd?: () => void) => {
    const text = buildWorkReportText(data)
    speak(text, onEnd)
  }, [speak])

  const isSpeaking = typeof window !== "undefined" && window.speechSynthesis
    ? speechSynthesis.speaking
    : false

  return { speak, speakWorkReport, stop, isSpeaking }
}

/**
 * フック外から直接呼べるスタンドアロン関数
 * （useCallback不要な場面、例: APIレスポンス後など）
 */
export function speakText(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return

  speechSynthesis.cancel()

  const preset = getSelectedPreset()
  const voice = getJapaneseVoice()

  const utt = new SpeechSynthesisUtterance(text)
  utt.lang = "ja-JP"
  utt.pitch = preset.pitch
  utt.rate = preset.rate
  utt.volume = 0.8
  if (voice) utt.voice = voice

  speechSynthesis.speak(utt)
}

export function speakWorkReport(data: WorkReportData) {
  speakText(buildWorkReportText(data))
}
