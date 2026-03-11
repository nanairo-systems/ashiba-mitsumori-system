/**
 * [PAGE] カラーパレット - 色指示・色管理ツール（足場システム側）
 */
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { ColorPalettePage } from "@/components/accounting/color-palette/ColorPalettePage"

export default async function ColorPalettePageRoute() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  return <ColorPalettePage />
}
