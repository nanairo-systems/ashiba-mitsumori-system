"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Loader2, Plus } from "lucide-react"
import { NewContactDialog } from "@/components/masters/NewContactDialog"

const schema = z.object({
  companyId: z.string().min(1, "会社を選択してください"),
  branchId: z.string().optional(),
  contactId: z.string().optional(),
  name: z.string().min(1, "現場名を入力してください"),
})

type FormValues = z.infer<typeof schema>

interface Company {
  id: string
  name: string
  branches: { id: string; name: string }[]
  contacts: { id: string; name: string }[]
}

interface Props {
  companies: Company[]
  currentUser: { id: string; name: string }
}

export function NewProjectForm({ companies }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showNewContact, setShowNewContact] = useState(false)
  const [localContacts, setLocalContacts] = useState<
    { id: string; name: string; companyId: string }[]
  >([])

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      companyId: "",
      branchId: "",
      contactId: "",
      name: "",
    },
  })

  const selectedCompanyId = form.watch("companyId")
  const selectedCompany = companies.find((c) => c.id === selectedCompanyId)
  const branches = selectedCompany?.branches ?? []
  const contacts = [
    ...(selectedCompany?.contacts ?? []),
    ...localContacts.filter((c) => c.companyId === selectedCompanyId),
  ]

  async function onSubmit(values: FormValues) {
    // 支店未選択の場合、最初の支店（本社）を自動使用
    const branchId = values.branchId || branches[0]?.id
    if (!branchId) {
      toast.error("会社に支店が登録されていません")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, branchId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(typeof err.error === "string" ? err.error : "エラーが発生しました")
      }
      const data = await res.json()
      toast.success("現場を作成しました")
      router.push(`/projects/${data.id}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "現場の作成に失敗しました")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">新規現場作成</h1>
        <p className="text-sm text-slate-500 mt-1">
          話が来た案件をすぐに登録します（仮現場名でもOK）
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* 会社 */}
            <FormField
              control={form.control}
              name="companyId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    会社 <span className="text-red-500">*</span>
                  </FormLabel>
                  <Select
                    onValueChange={(v) => {
                      field.onChange(v)
                      form.setValue("branchId", "")
                      form.setValue("contactId", "")
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="会社を選択" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {companies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 支店（2つ以上ある場合のみ表示） */}
            {branches.length > 1 && (
              <FormField
                control={form.control}
                name="branchId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>支店</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={!selectedCompanyId}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="支店を選択（任意）" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {branches.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* 担当者 */}
            <FormField
              control={form.control}
              name="contactId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>先方担当者</FormLabel>
                  <div className="flex gap-2">
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={!selectedCompanyId}
                    >
                      <FormControl>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="担当者を選択（任意）" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {contacts.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={!selectedCompanyId}
                      onClick={() => setShowNewContact(true)}
                      title="新規担当者登録"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 現場名 */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    現場名 <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="例：〇〇ビル新築工事（仮）"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                キャンセル
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                現場を作成
              </Button>
            </div>
          </form>
        </Form>
      </div>

      {/* 新規担当者ダイアログ */}
      {showNewContact && selectedCompanyId && (
        <NewContactDialog
          companyId={selectedCompanyId}
          onClose={() => setShowNewContact(false)}
          onCreated={(contact) => {
            setLocalContacts((prev) => [...prev, { ...contact, companyId: selectedCompanyId }])
            form.setValue("contactId", contact.id)
            setShowNewContact(false)
            toast.success("担当者を登録しました")
          }}
        />
      )}
    </div>
  )
}
