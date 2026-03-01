/**
 * [LAYOUT] 印刷専用レイアウト
 *
 * サイドバー・ヘッダーなし。
 * 印刷・PDFプレビューページで使用する最小構成レイアウト。
 * @media print ではブラウザのデフォルトスタイルが適用される。
 */
export default function PrintLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
