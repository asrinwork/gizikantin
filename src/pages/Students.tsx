import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, QrCode, Download, FileDown, Upload, KeyRound, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { StudentBarcode } from "@/components/StudentBarcode";
import { downloadStudentBarcodePNG, downloadBulkBarcodesPDF } from "@/lib/barcode-pdf";
import { StudentImportDialog } from "@/components/StudentImportDialog";
import { ACTIVITY_LABEL, type ActivityLevel } from "@/lib/calorie";
import { DataTable } from "@/components/DataTable";
import { DialogDescription } from "@/components/ui/dialog";

interface ClassRow { id: string; name: string; }
interface Student {
  id: string; nis: string; full_name: string; class_name: string; class_id: string | null;
  gender: "L" | "P" | null; birth_date: string | null;
  height_cm: number | null; weight_kg: number | null; activity_level: ActivityLevel | null;
}
const empty: any = {
  nis: "", full_name: "", class_name: "", class_id: null, gender: "L", birth_date: "",
  height_cm: "", weight_kg: "", activity_level: "light",
};

const Students = () => {
  const [list, setList] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState<any>(empty);
  const [barcodeStudent, setBarcodeStudent] = useState<Student | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = async () => {
    const [s, c] = await Promise.all([
      supabase.from("students").select("*").order("class_name").order("full_name"),
      supabase.from("classes").select("id,name").order("name"),
    ]);
    setList((s.data ?? []) as any);
    setClasses((c.data ?? []) as any);
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
    const payload: any = {
      nis: form.nis, full_name: form.full_name,
      class_name: cls?.name ?? form.class_name,
      class_id: form.class_id || null,
      gender: form.gender, birth_date: form.birth_date || null,
      height_cm: form.height_cm ? +form.height_cm : null,
      weight_kg: form.weight_kg ? +form.weight_kg : null,
      activity_level: form.activity_level,
    };
    if (editing) {
      const { error } = await supabase.from("students").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Siswa diperbarui");
    } else {
      const { error } = await supabase.from("students").insert(payload);
      if (error) return toast.error(error.message);
      toast.success("Siswa ditambahkan. Gunakan Import CSV untuk membuat akun login.");
    }
    setOpen(false); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Hapus siswa? Semua riwayat transaksinya juga ikut terhapus.")) return;
    const { error } = await supabase.from("students").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Dihapus"); load();
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
              { key: "akun", header: "Akun", accessor: (s) => ((s as any).user_id ? "1" : "0"), cell: (s) => (s as any).user_id ? <span className="text-success text-xs">✓</span> : <span className="text-muted-foreground text-xs">—</span> },
              {
                key: "act", header: "", sortable: false, align: "right",
                cell: (s) => (
                  <div className="whitespace-nowrap">
                    <Button size="icon" variant="ghost" title="Lihat QR" onClick={() => setBarcodeStudent(s)}><QrCode className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" title="Unduh QR" onClick={() => downloadStudentBarcodePNG(s)}><Download className="h-4 w-4" /></Button>
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
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
              <Button type="submit">Simpan</Button>
            </DialogFooter>
          </form>
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

      <StudentImportDialog open={importOpen} onOpenChange={setImportOpen} onDone={load} />
    </div>
  );
};

export default Students;
