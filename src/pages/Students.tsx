import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, QrCode, Download, FileDown, Upload, KeyRound, Copy, Loader2, Eye, EyeOff } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { StudentBarcode } from "@/components/StudentBarcode";
import { downloadStudentBarcodePNG, downloadBulkBarcodesPDF } from "@/lib/barcode-pdf";
import { StudentImportDialog } from "@/components/StudentImportDialog";
import { ACTIVITY_LABEL, type ActivityLevel } from "@/lib/calorie";
import { DataTable } from "@/components/DataTable";
import { DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { computeBMI, bmiCategory, bmiBadgeClass, formatNum } from "@/lib/nutrition";

interface ClassRow { id: string; name: string; }
interface Student {
  id: string; nis: string; full_name: string; class_name: string; class_id: string | null;
  gender: "L" | "P" | null; birth_date: string | null;
  height_cm: number | null; weight_kg: number | null; activity_level: ActivityLevel | null;
  user_id?: string | null;
}
const empty: any = {
  nis: "", full_name: "", class_name: "", class_id: null, gender: "L", birth_date: "",
  height_cm: "", weight_kg: "", activity_level: "light", email: "", password: "",
};

const Students = () => {
  const [list, setList] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [creds, setCreds] = useState<Record<string, { email: string; password: string }>>({});
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState<any>(empty);
  const [barcodeStudent, setBarcodeStudent] = useState<Student | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createdInfo, setCreatedInfo] = useState<{ email: string; password: string; name: string } | null>(null);
  const [credsFor, setCredsFor] = useState<Student | null>(null);
  const [showPwAll, setShowPwAll] = useState(false);

  // reset password
  const [resetFor, setResetFor] = useState<Student | null>(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetResult, setResetResult] = useState<string | null>(null);

  const load = async () => {
    const [s, c, cr] = await Promise.all([
      supabase.from("students").select("*").order("class_name").order("full_name"),
      supabase.from("classes").select("id,name").order("name"),
      supabase.from("student_credentials").select("user_id,email,password"),
    ]);
    setList((s.data ?? []) as any);
    setClasses((c.data ?? []) as any);
    const map: Record<string, { email: string; password: string }> = {};
    (cr.data ?? []).forEach((r: any) => { map[r.user_id] = { email: r.email, password: r.password }; });
    setCreds(map);
  };
  useEffect(() => { load(); }, []);

  const startNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const startEdit = (s: Student) => {
    setEditing(s);
    setForm({
      ...s,
      birth_date: s.birth_date ?? "",
      height_cm: s.height_cm ?? "",
      weight_kg: s.weight_kg ?? "",
      activity_level: s.activity_level ?? "light",
    });
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cls = classes.find((c) => c.id === form.class_id);
    if (editing) {
      const payload: any = {
        nis: form.nis, full_name: form.full_name,
        class_name: cls?.name ?? form.class_name,
        class_id: form.class_id || null,
        gender: form.gender, birth_date: form.birth_date || null,
        height_cm: form.height_cm ? +form.height_cm : null,
        weight_kg: form.weight_kg ? +form.weight_kg : null,
        activity_level: form.activity_level,
      };
      const { error } = await supabase.from("students").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Siswa diperbarui");
      setOpen(false); load();
    } else {
      // Manual create — also create login account via edge function
      setCreateBusy(true);
      const row = {
        nis: form.nis, full_name: form.full_name,
        class_name: cls?.name ?? form.class_name,
        class_id: form.class_id || null,
        gender: form.gender, birth_date: form.birth_date || null,
        height_cm: form.height_cm ? +form.height_cm : null,
        weight_kg: form.weight_kg ? +form.weight_kg : null,
        activity_level: form.activity_level,
        email: form.email || undefined,
        password: form.password || undefined,
      };
      const { data, error } = await supabase.functions.invoke("bulk-create-students", { body: { students: [row] } });
      setCreateBusy(false);
      if (error || (data as any)?.error) return toast.error((data as any)?.error ?? error?.message);
      const res = (data as any).results?.[0];
      if (!res?.ok) return toast.error(res?.error || "Gagal membuat akun");
      setOpen(false);
      setCreatedInfo({ name: form.full_name, email: res.email, password: res.password });
      load();
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Hapus siswa? Semua riwayat transaksinya juga ikut terhapus.")) return;
    const { error } = await supabase.from("students").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Dihapus"); load();
  };

  const runReset = async () => {
    if (!resetFor?.user_id) return toast.error("Siswa ini belum punya akun login");
    setResetBusy(true);
    const { data, error } = await supabase.functions.invoke("admin-reset-password", { body: { user_id: resetFor.user_id } });
    setResetBusy(false);
    if (error || (data as any)?.error) return toast.error((data as any)?.error ?? error?.message);
    setResetResult((data as any).password);
    toast.success("Password berhasil direset");
  };

  const exportCSV = (includeCreds = false) => {
    if (!list.length) return toast.error("Belum ada data");
    const headers = ["nis","nama","kelas","gender","tgl_lahir","tinggi_cm","berat_kg","imt","status_imt","aktivitas"];
    if (includeCreds) headers.push("email","password");
    const esc = (v: any) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.join(",")].concat(
      list.map((s) => {
        const bmi = computeBMI(s.weight_kg, s.height_cm);
        const cat = bmiCategory(bmi);
        const cred = s.user_id ? creds[s.user_id] : null;
        const row: any[] = [s.nis, s.full_name, s.class_name, s.gender ?? "", s.birth_date ?? "", s.height_cm ?? "", s.weight_kg ?? "", bmi != null ? bmi.toFixed(1) : "", cat ?? "", s.activity_level ?? ""];
        if (includeCreds) row.push(cred?.email ?? "", cred?.password ?? "");
        return row.map(esc).join(",");
      })
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `siswa${includeCreds ? "-lengkap" : ""}-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    toast.success(`${list.length} siswa diekspor`);
  };

  const handleBulkDownload = async () => {
    if (list.length === 0) { toast.error("Belum ada siswa"); return; }
    setBulkBusy(true);
    try { await downloadBulkBarcodesPDF(list); toast.success(`PDF ${list.length} QR code diunduh`); }
    catch (e: any) { toast.error("Gagal: " + (e?.message ?? e)); }
    finally { setBulkBusy(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Data Siswa</h1>
          <p className="text-muted-foreground">Kelola data siswa & akun login</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-2" /> Import CSV
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={list.length === 0}>
                <Download className="h-4 w-4 mr-2" /> Export CSV
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportCSV(false)}>Tanpa email & password</DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportCSV(true)}>Lengkap (termasuk email & password)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" onClick={handleBulkDownload} disabled={bulkBusy || list.length === 0}>
            <FileDown className="h-4 w-4 mr-2" />{bulkBusy ? "Menyiapkan..." : "Unduh Semua QR"}
          </Button>
          <Button onClick={startNew}><Plus className="h-4 w-4 mr-2" />Tambah</Button>
        </div>
      </div>

      <Card className="shadow-soft">
        <CardHeader><CardTitle>Daftar Siswa ({list.length})</CardTitle></CardHeader>
        <CardContent>
          <DataTable
            data={list}
            rowKey={(s) => s.id}
            searchPlaceholder="Cari NIS, nama, atau kelas..."
            emptyMessage="Belum ada siswa."
            columns={[
              { key: "nis", header: "NIS", accessor: (s) => s.nis, cell: (s) => <span className="font-mono text-xs">{s.nis}</span> },
              { key: "full_name", header: "Nama", accessor: (s) => s.full_name, cell: (s) => <span className="font-medium">{s.full_name}</span> },
              { key: "class_name", header: "Kelas", accessor: (s) => s.class_name, cell: (s) => s.class_name },
              { key: "gender", header: "JK", accessor: (s) => s.gender ?? "", cell: (s) => (s.gender === "P" ? "P" : "L") },
              { key: "tbbb", header: "TB/BB", accessor: (s) => s.height_cm ?? 0, cell: (s) => <span className="text-xs">{s.height_cm ?? "-"}/{s.weight_kg ?? "-"}</span> },
              {
                key: "imt", header: "Status IMT",
                accessor: (s) => computeBMI(s.weight_kg, s.height_cm) ?? -1,
                cell: (s) => {
                  const bmi = computeBMI(s.weight_kg, s.height_cm);
                  const cat = bmiCategory(bmi);
                  if (!cat) return <span className="text-xs text-muted-foreground">—</span>;
                  return (
                    <div className="flex flex-col gap-0.5">
                      <Badge className={bmiBadgeClass(cat) + " w-fit"}>{cat}</Badge>
                      <span className="text-[10px] text-muted-foreground">IMT {formatNum(bmi!, 1)}</span>
                    </div>
                  );
                },
              },
              { key: "akun", header: "Akun", accessor: (s) => ((s as any).user_id ? "1" : "0"), cell: (s) => (s as any).user_id ? <span className="text-success text-xs">✓</span> : <span className="text-muted-foreground text-xs">—</span> },
              {
                key: "act", header: "", sortable: false, align: "right",
                cell: (s) => (
                  <div className="whitespace-nowrap">
                    <Button size="icon" variant="ghost" title="Lihat QR" onClick={() => setBarcodeStudent(s)}><QrCode className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" title="Unduh QR" onClick={() => downloadStudentBarcodePNG(s)}><Download className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" title="Lihat email & password" disabled={!s.user_id || !creds[s.user_id!]} onClick={() => setCredsFor(s)}><Eye className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" title="Reset password" disabled={!s.user_id} onClick={() => { setResetFor(s); setResetResult(null); }}><KeyRound className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => startEdit(s)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                ),
              },
            ]}
          />
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit" : "Tambah"} Siswa</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>NIS</Label><Input required value={form.nis} onChange={(e) => setForm({ ...form, nis: e.target.value })} /></div>
              <div>
                <Label>Kelas</Label>
                <Select value={form.class_id ?? ""} onValueChange={(v) => setForm({ ...form, class_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Pilih kelas" /></SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Nama Lengkap</Label><Input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Jenis Kelamin</Label>
                <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="L">Laki-laki</SelectItem><SelectItem value="P">Perempuan</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Tanggal Lahir</Label><Input type="date" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} /></div>
              <div><Label>Tinggi (cm)</Label><Input type="number" step="0.1" value={form.height_cm} onChange={(e) => setForm({ ...form, height_cm: e.target.value })} /></div>
              <div><Label>Berat (kg)</Label><Input type="number" step="0.1" value={form.weight_kg} onChange={(e) => setForm({ ...form, weight_kg: e.target.value })} /></div>
            </div>
            <div>
              <Label>Aktivitas</Label>
              <Select value={form.activity_level} onValueChange={(v) => setForm({ ...form, activity_level: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ACTIVITY_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {!editing && (
              <div className="rounded-md border bg-muted/30 p-3 space-y-3">
                <p className="text-xs font-medium text-muted-foreground">Akun login (otomatis dibuat)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Email <span className="text-xs text-muted-foreground">(opsional)</span></Label>
                    <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="default: NIS@sekolah.local" />
                  </div>
                  <div>
                    <Label>Password <span className="text-xs text-muted-foreground">(opsional, min 6)</span></Label>
                    <Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="default: NIS" />
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
              <Button type="submit" disabled={createBusy}>{createBusy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Simpan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Credentials shown after create */}
      <Dialog open={!!createdInfo} onOpenChange={(o) => !o && setCreatedInfo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Akun siswa berhasil dibuat</DialogTitle>
            <DialogDescription>Catat email & password berikut — password tidak akan ditampilkan lagi.</DialogDescription>
          </DialogHeader>
          {createdInfo && (
            <div className="space-y-3">
              <div><Label>Nama</Label><Input readOnly value={createdInfo.name} /></div>
              <div><Label>Email</Label>
                <div className="flex gap-2"><Input readOnly value={createdInfo.email} className="font-mono" />
                  <Button type="button" variant="outline" onClick={() => { navigator.clipboard.writeText(createdInfo.email); toast.success("Disalin"); }}><Copy className="h-4 w-4" /></Button>
                </div>
              </div>
              <div><Label>Password</Label>
                <div className="flex gap-2"><Input readOnly value={createdInfo.password} className="font-mono" />
                  <Button type="button" variant="outline" onClick={() => { navigator.clipboard.writeText(createdInfo.password); toast.success("Disalin"); }}><Copy className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter><Button onClick={() => setCreatedInfo(null)}>Selesai</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset password dialog */}
      <Dialog open={!!resetFor} onOpenChange={(o) => { if (!o) { setResetFor(null); setResetResult(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password Siswa</DialogTitle>
            <DialogDescription>
              {resetFor && <>Akun: <b>{resetFor.full_name}</b> ({resetFor.nis})</>}
            </DialogDescription>
          </DialogHeader>
          {!resetResult ? (
            <p className="text-sm text-muted-foreground">Password lama tidak dapat dilihat. Setelah direset, password baru akan ditampilkan satu kali.</p>
          ) : (
            <div className="space-y-2">
              <Label>Password baru (catat sekarang)</Label>
              <div className="flex gap-2">
                <Input readOnly value={resetResult} className="font-mono" />
                <Button type="button" variant="outline" onClick={() => { navigator.clipboard.writeText(resetResult); toast.success("Disalin"); }}><Copy className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
          <DialogFooter>
            {!resetResult ? (
              <>
                <Button variant="outline" onClick={() => setResetFor(null)}>Batal</Button>
                <Button onClick={runReset} disabled={resetBusy}>{resetBusy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Reset</Button>
              </>
            ) : (
              <Button onClick={() => { setResetFor(null); setResetResult(null); }}>Selesai</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!barcodeStudent} onOpenChange={(o) => !o && setBarcodeStudent(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>QR Code Siswa</DialogTitle></DialogHeader>
          {barcodeStudent && (
            <div className="space-y-3 text-center">
              <div>
                <p className="font-semibold">{barcodeStudent.full_name}</p>
                <p className="text-sm text-muted-foreground">Kelas {barcodeStudent.class_name}</p>
              </div>
              <div className="bg-white rounded-md p-3 flex justify-center"><StudentBarcode value={barcodeStudent.nis} /></div>
              <Button className="w-full" onClick={() => downloadStudentBarcodePNG(barcodeStudent)}><Download className="h-4 w-4 mr-2" /> Unduh PNG</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View credentials */}
      <Dialog open={!!credsFor} onOpenChange={(o) => { if (!o) { setCredsFor(null); setShowPwAll(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Akun Login Siswa</DialogTitle>
            <DialogDescription>
              {credsFor && <>Akun: <b>{credsFor.full_name}</b> ({credsFor.nis})</>}
            </DialogDescription>
          </DialogHeader>
          {credsFor && credsFor.user_id && creds[credsFor.user_id] ? (
            <div className="space-y-3">
              <div><Label>Email</Label>
                <div className="flex gap-2"><Input readOnly value={creds[credsFor.user_id].email} className="font-mono" />
                  <Button type="button" variant="outline" onClick={() => { navigator.clipboard.writeText(creds[credsFor.user_id!].email); toast.success("Disalin"); }}><Copy className="h-4 w-4" /></Button>
                </div>
              </div>
              <div><Label>Password</Label>
                <div className="flex gap-2">
                  <Input readOnly value={creds[credsFor.user_id].password} className="font-mono" type={showPwAll ? "text" : "password"} />
                  <Button type="button" variant="outline" onClick={() => setShowPwAll((v) => !v)}>{showPwAll ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
                  <Button type="button" variant="outline" onClick={() => { navigator.clipboard.writeText(creds[credsFor.user_id!].password); toast.success("Disalin"); }}><Copy className="h-4 w-4" /></Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Password disimpan dari proses pembuatan/reset akun. Jika siswa mengubah password sendiri, nilai di sini tidak akan ikut berubah.</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Password tidak tersedia. Lakukan reset password untuk menghasilkan dan menyimpan password baru.</p>
          )}
          <DialogFooter><Button onClick={() => setCredsFor(null)}>Tutup</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <StudentImportDialog open={importOpen} onOpenChange={setImportOpen} onDone={load} />
    </div>
  );
};

export default Students;
