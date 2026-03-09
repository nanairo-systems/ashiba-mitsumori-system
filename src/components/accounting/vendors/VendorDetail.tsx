/**
 * [COMPONENT] 経理 - 取引先詳細（タブ形式）
 *
 * 基本情報・保険/許可・車両・従業員・書類の5タブ
 */
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Save, Plus, Truck, Users } from "lucide-react"
import { toast } from "sonner"

interface VendorData {
  id: string
  name: string
  furigana: string | null
  representativeName: string | null
  phone: string | null
  email: string | null
  address: string | null
  bankName: string | null
  branchName: string | null
  accountType: string | null
  accountNumber: string | null
  accountHolder: string | null
  closingType: string
  hasInvoiceRegistration: boolean
  invoiceNumber: string | null
  constructionInsuranceCompany: string | null
  constructionInsuranceNumber: string | null
  constructionInsuranceExpiry: string | null
  vehicleInsuranceCompany: string | null
  vehicleInsuranceNumber: string | null
  vehicleInsuranceExpiry: string | null
  compulsoryInsuranceExpiry: string | null
  constructionLicenseNumber: string | null
  constructionLicenseExpiry: string | null
  laborInsuranceNumber: string | null
  employmentInsuranceNumber: string | null
  hasForeignWorkers: boolean
  foreignWorkerNote: string | null
  startDate: string | null
  rating: string | null
  antisocialCheckDone: boolean
  isSuspended: boolean
  suspensionReason: string | null
  emergencyContact: string | null
  note: string | null
  companyId: string
  company: { id: string; name: string }
  vehicles: VehicleData[]
  employees: EmployeeData[]
  [key: string]: unknown
}

interface VehicleData {
  id: string
  plateNumber: string | null
  vehicleType: string | null
  compulsoryExpiry: string | null
  insuranceExpiry: string | null
  note: string | null
}

interface EmployeeData {
  id: string
  name: string
  birthDate: string | null
  position: string | null
  qualifications: string | null
  isForeignWorker: boolean
  residenceStatus: string | null
  note: string | null
  isActive: boolean
}

interface Props {
  vendor: VendorData
  companies: { id: string; name: string }[]
}

export function VendorDetail({ vendor: initialVendor, companies }: Props) {
  const router = useRouter()
  const [vendor, setVendor] = useState(initialVendor)
  const [saving, setSaving] = useState(false)
  const [vehicleDialog, setVehicleDialog] = useState(false)
  const [employeeDialog, setEmployeeDialog] = useState(false)

  const [vehicleForm, setVehicleForm] = useState({
    plateNumber: "", vehicleType: "", note: "",
    compulsoryExpiry: "", insuranceExpiry: "",
  })
  const [employeeForm, setEmployeeForm] = useState({
    name: "", position: "", qualifications: "",
    isForeignWorker: false, residenceStatus: "", note: "",
  })

  function updateField(field: string, value: unknown) {
    setVendor((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/accounting/vendors/${vendor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: vendor.name,
          furigana: vendor.furigana,
          representativeName: vendor.representativeName,
          phone: vendor.phone,
          email: vendor.email,
          address: vendor.address,
          bankName: vendor.bankName,
          branchName: vendor.branchName,
          accountType: vendor.accountType,
          accountNumber: vendor.accountNumber,
          accountHolder: vendor.accountHolder,
          closingType: vendor.closingType,
          hasInvoiceRegistration: vendor.hasInvoiceRegistration,
          invoiceNumber: vendor.invoiceNumber,
          constructionInsuranceCompany: vendor.constructionInsuranceCompany,
          constructionInsuranceNumber: vendor.constructionInsuranceNumber,
          constructionInsuranceExpiry: vendor.constructionInsuranceExpiry,
          vehicleInsuranceCompany: vendor.vehicleInsuranceCompany,
          vehicleInsuranceNumber: vendor.vehicleInsuranceNumber,
          vehicleInsuranceExpiry: vendor.vehicleInsuranceExpiry,
          compulsoryInsuranceExpiry: vendor.compulsoryInsuranceExpiry,
          constructionLicenseNumber: vendor.constructionLicenseNumber,
          constructionLicenseExpiry: vendor.constructionLicenseExpiry,
          laborInsuranceNumber: vendor.laborInsuranceNumber,
          employmentInsuranceNumber: vendor.employmentInsuranceNumber,
          hasForeignWorkers: vendor.hasForeignWorkers,
          foreignWorkerNote: vendor.foreignWorkerNote,
          emergencyContact: vendor.emergencyContact,
          note: vendor.note,
          rating: vendor.rating,
          antisocialCheckDone: vendor.antisocialCheckDone,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "保存に失敗しました")
        return
      }
      toast.success("保存しました")
    } catch {
      toast.error("通信エラーが発生しました")
    } finally {
      setSaving(false)
    }
  }

  async function handleAddVehicle() {
    try {
      const res = await fetch(`/api/accounting/vendors/${vendor.id}`, {
        method: "GET",
      })
      // 車両追加は将来的に専用APIで対応
      toast.info("車両の追加機能は準備中です")
      setVehicleDialog(false)
    } catch {
      toast.error("通信エラーが発生しました")
    }
  }

  async function handleAddEmployee() {
    toast.info("従業員の追加機能は準備中です")
    setEmployeeDialog(false)
  }

  const formatDate = (d: string | null) => {
    if (!d) return "-"
    return new Date(d).toLocaleDateString("ja-JP")
  }

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/accounting/vendors")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-slate-800">{vendor.name}</h1>
            <p className="text-sm text-slate-500">{vendor.company.name}</p>
          </div>
          {vendor.isSuspended && <Badge className="bg-red-100 text-red-700">停止中</Badge>}
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-1.5">
          <Save className="w-4 h-4" />
          {saving ? "保存中..." : "保存"}
        </Button>
      </div>

      {/* タブ */}
      <Tabs defaultValue="basic" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="basic">基本情報</TabsTrigger>
          <TabsTrigger value="insurance">保険・許可</TabsTrigger>
          <TabsTrigger value="vehicles">車両</TabsTrigger>
          <TabsTrigger value="employees">従業員</TabsTrigger>
          <TabsTrigger value="documents">書類</TabsTrigger>
        </TabsList>

        {/* 基本情報タブ */}
        <TabsContent value="basic" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">会社情報</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">会社名</Label>
                  <Input value={vendor.name} onChange={(e) => updateField("name", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">ふりがな</Label>
                  <Input value={vendor.furigana ?? ""} onChange={(e) => updateField("furigana", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">代表者名</Label>
                  <Input value={vendor.representativeName ?? ""} onChange={(e) => updateField("representativeName", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">会社区分</Label>
                  <Select value={vendor.companyId} onValueChange={(v) => updateField("companyId", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {companies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">電話番号</Label>
                  <Input value={vendor.phone ?? ""} onChange={(e) => updateField("phone", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">メール</Label>
                  <Input value={vendor.email ?? ""} onChange={(e) => updateField("email", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">緊急連絡先</Label>
                  <Input value={vendor.emergencyContact ?? ""} onChange={(e) => updateField("emergencyContact", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">支払区分</Label>
                  <Select value={vendor.closingType} onValueChange={(v) => updateField("closingType", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MONTH_END">月末締め</SelectItem>
                      <SelectItem value="DAY_15">15日締め</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">住所</Label>
                <Input value={vendor.address ?? ""} onChange={(e) => updateField("address", e.target.value)} />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={vendor.hasInvoiceRegistration} onChange={(e) => updateField("hasInvoiceRegistration", e.target.checked)} className="rounded" />
                  インボイス登録あり
                </label>
                {vendor.hasInvoiceRegistration && (
                  <div className="flex-1">
                    <Input value={vendor.invoiceNumber ?? ""} onChange={(e) => updateField("invoiceNumber", e.target.value)} placeholder="T1234567890123" />
                  </div>
                )}
              </div>
              <div>
                <Label className="text-xs">備考</Label>
                <Textarea value={vendor.note ?? ""} onChange={(e) => updateField("note", e.target.value)} rows={3} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">銀行口座</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs">銀行名</Label>
                  <Input value={vendor.bankName ?? ""} onChange={(e) => updateField("bankName", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">支店名</Label>
                  <Input value={vendor.branchName ?? ""} onChange={(e) => updateField("branchName", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">口座種別</Label>
                  <Select value={vendor.accountType ?? ""} onValueChange={(v) => updateField("accountType", v)}>
                    <SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ORDINARY">普通</SelectItem>
                      <SelectItem value="CURRENT">当座</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">口座番号</Label>
                  <Input value={vendor.accountNumber ?? ""} onChange={(e) => updateField("accountNumber", e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">口座名義</Label>
                  <Input value={vendor.accountHolder ?? ""} onChange={(e) => updateField("accountHolder", e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 保険・許可タブ */}
        <TabsContent value="insurance" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">建設工事保険</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs">保険会社</Label>
                  <Input value={vendor.constructionInsuranceCompany ?? ""} onChange={(e) => updateField("constructionInsuranceCompany", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">証券番号</Label>
                  <Input value={vendor.constructionInsuranceNumber ?? ""} onChange={(e) => updateField("constructionInsuranceNumber", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">有効期限</Label>
                  <Input type="date" value={vendor.constructionInsuranceExpiry?.split("T")[0] ?? ""} onChange={(e) => updateField("constructionInsuranceExpiry", e.target.value || null)} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">車両保険</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs">保険会社</Label>
                  <Input value={vendor.vehicleInsuranceCompany ?? ""} onChange={(e) => updateField("vehicleInsuranceCompany", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">証券番号</Label>
                  <Input value={vendor.vehicleInsuranceNumber ?? ""} onChange={(e) => updateField("vehicleInsuranceNumber", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">有効期限</Label>
                  <Input type="date" value={vendor.vehicleInsuranceExpiry?.split("T")[0] ?? ""} onChange={(e) => updateField("vehicleInsuranceExpiry", e.target.value || null)} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">自賠責保険</CardTitle></CardHeader>
            <CardContent>
              <div>
                <Label className="text-xs">有効期限</Label>
                <Input type="date" value={vendor.compulsoryInsuranceExpiry?.split("T")[0] ?? ""} onChange={(e) => updateField("compulsoryInsuranceExpiry", e.target.value || null)} className="max-w-xs" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">建設業許可</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">許可番号</Label>
                  <Input value={vendor.constructionLicenseNumber ?? ""} onChange={(e) => updateField("constructionLicenseNumber", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">有効期限</Label>
                  <Input type="date" value={vendor.constructionLicenseExpiry?.split("T")[0] ?? ""} onChange={(e) => updateField("constructionLicenseExpiry", e.target.value || null)} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">労災・雇用保険</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">労災保険番号</Label>
                  <Input value={vendor.laborInsuranceNumber ?? ""} onChange={(e) => updateField("laborInsuranceNumber", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">雇用保険番号</Label>
                  <Input value={vendor.employmentInsuranceNumber ?? ""} onChange={(e) => updateField("employmentInsuranceNumber", e.target.value)} />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={vendor.hasForeignWorkers} onChange={(e) => updateField("hasForeignWorkers", e.target.checked)} className="rounded" />
                  外国人労働者あり
                </label>
                {vendor.hasForeignWorkers && (
                  <div className="flex-1">
                    <Input value={vendor.foreignWorkerNote ?? ""} onChange={(e) => updateField("foreignWorkerNote", e.target.value)} placeholder="備考" />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 車両タブ */}
        <TabsContent value="vehicles" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-700 flex items-center gap-2">
              <Truck className="w-4 h-4" />
              車両一覧（{vendor.vehicles.length}台）
            </h2>
            <Dialog open={vehicleDialog} onOpenChange={setVehicleDialog}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1.5">
                  <Plus className="w-4 h-4" />
                  車両追加
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>車両追加</DialogTitle></DialogHeader>
                <div className="space-y-3 py-2">
                  <div>
                    <Label className="text-xs">ナンバープレート</Label>
                    <Input value={vehicleForm.plateNumber} onChange={(e) => setVehicleForm({ ...vehicleForm, plateNumber: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">車種</Label>
                    <Input value={vehicleForm.vehicleType} onChange={(e) => setVehicleForm({ ...vehicleForm, vehicleType: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">自賠責期限</Label>
                      <Input type="date" value={vehicleForm.compulsoryExpiry} onChange={(e) => setVehicleForm({ ...vehicleForm, compulsoryExpiry: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs">任意保険期限</Label>
                      <Input type="date" value={vehicleForm.insuranceExpiry} onChange={(e) => setVehicleForm({ ...vehicleForm, insuranceExpiry: e.target.value })} />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => setVehicleDialog(false)}>キャンセル</Button>
                    <Button onClick={handleAddVehicle}>追加</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="rounded-lg border bg-white overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>ナンバー</TableHead>
                  <TableHead>車種</TableHead>
                  <TableHead>自賠責期限</TableHead>
                  <TableHead>任意保険期限</TableHead>
                  <TableHead>備考</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendor.vehicles.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-400">車両データがありません</TableCell></TableRow>
                ) : (
                  vendor.vehicles.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium">{v.plateNumber || "-"}</TableCell>
                      <TableCell>{v.vehicleType || "-"}</TableCell>
                      <TableCell>{formatDate(v.compulsoryExpiry)}</TableCell>
                      <TableCell>{formatDate(v.insuranceExpiry)}</TableCell>
                      <TableCell className="text-sm text-slate-500">{v.note || "-"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* 従業員タブ */}
        <TabsContent value="employees" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-700 flex items-center gap-2">
              <Users className="w-4 h-4" />
              従業員一覧（{vendor.employees.length}名）
            </h2>
            <Dialog open={employeeDialog} onOpenChange={setEmployeeDialog}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1.5">
                  <Plus className="w-4 h-4" />
                  従業員追加
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>従業員追加</DialogTitle></DialogHeader>
                <div className="space-y-3 py-2">
                  <div>
                    <Label className="text-xs">氏名 *</Label>
                    <Input value={employeeForm.name} onChange={(e) => setEmployeeForm({ ...employeeForm, name: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">役職</Label>
                      <Input value={employeeForm.position} onChange={(e) => setEmployeeForm({ ...employeeForm, position: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs">資格</Label>
                      <Input value={employeeForm.qualifications} onChange={(e) => setEmployeeForm({ ...employeeForm, qualifications: e.target.value })} />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={employeeForm.isForeignWorker} onChange={(e) => setEmployeeForm({ ...employeeForm, isForeignWorker: e.target.checked })} className="rounded" />
                    外国人労働者
                  </label>
                  {employeeForm.isForeignWorker && (
                    <div>
                      <Label className="text-xs">在留資格</Label>
                      <Input value={employeeForm.residenceStatus} onChange={(e) => setEmployeeForm({ ...employeeForm, residenceStatus: e.target.value })} />
                    </div>
                  )}
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => setEmployeeDialog(false)}>キャンセル</Button>
                    <Button onClick={handleAddEmployee}>追加</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="rounded-lg border bg-white overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>氏名</TableHead>
                  <TableHead>役職</TableHead>
                  <TableHead>資格</TableHead>
                  <TableHead>外国人</TableHead>
                  <TableHead>ステータス</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendor.employees.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-400">従業員データがありません</TableCell></TableRow>
                ) : (
                  vendor.employees.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.name}</TableCell>
                      <TableCell>{e.position || "-"}</TableCell>
                      <TableCell className="text-sm">{e.qualifications || "-"}</TableCell>
                      <TableCell>
                        {e.isForeignWorker ? (
                          <Badge className="bg-amber-100 text-amber-700 text-xs">{e.residenceStatus || "外国人"}</Badge>
                        ) : "-"}
                      </TableCell>
                      <TableCell>
                        {e.isActive ? (
                          <Badge className="bg-emerald-100 text-emerald-700 text-xs">有効</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-slate-400">無効</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* 書類タブ */}
        <TabsContent value="documents">
          <Card>
            <CardContent className="py-12 text-center text-slate-400">
              <p>書類管理機能は準備中です</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
