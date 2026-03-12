/**
 * [PAGE] 音声通知設定 (/settings/voice)
 *
 * Web Speech API を使った音声通知の試聴・設定ページ
 * - 日本語女性ボイスのサンプル試聴
 * - 作業内容報告のサンプル会話
 * - 番号キーで再生
 */
import { VoiceSamplePlayer } from "@/components/settings/VoiceSamplePlayer"

export default function VoiceSettingsPage() {
  return (
    <div className="max-w-3xl mx-auto py-6 px-4">
      <h1 className="text-xl font-bold text-slate-800 mb-1">音声通知設定</h1>
      <p className="text-sm text-slate-500 mb-6">
        通知や作業内容報告に使用する音声を選択してください。番号キー（1〜6）でもサンプルを再生できます。
      </p>
      <VoiceSamplePlayer />
    </div>
  )
}
