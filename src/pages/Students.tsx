import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, QrCode, Download, FileDown } from "lucide-react";
import { toast } from "sonner";
import { StudentBarcode } from "@/components/StudentBarcode";
import { downloadStudentBarcodePNG, downloadBulkBarcodesPDF } from "@/lib/barcode-pdf";

interface Student {
  id: string; nis: string; full_name: string; class_name: string;
  gender: "L" | "P" | null; birth_date: string | null;
}
const empty: any = { nis: "", full_name: "", class_name: "", gender: "L", birth_date: "" };

const Students = () => {
  const [list, setList] = useState<Student[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState<any>(empty);
  const [barcodeStudent, setBarcodeStudent] = useState<Student | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("students").select("*").order("class_name").order("full_name");
    setList((data ?? []) as any);
  };
  useEffect(() => { load(); }, []);

  const startNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const startEdit = (s: Student) => { setEditing(s); setForm({ ...s, birth_date: s.birth_date ?? "" }); setOpen(true); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {
      nis: form.nis, full_name: form.full_name, class_name: form.class_name,
      gender: form.gender, birth_date: form.birth_date || null,
    };
    if (editing) {
      const { error } = await supabase.from("students").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Siswa diperbarui");
    } else {
      const { error } = await supabase.from("students").insert(payload);
      if (error) return toast.error(error.message);
      toast.success("Siswa ditambahkan — barcode siap dicetak");
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
    if (list.length === 0) {
      toast.error("Belum ada siswa untuk diunduh");
      return;
    }
    setBulkBusy(true);
    try {
      // Allow UI to update before heavy sync work
      await new Promise((r) => setTimeout(r, 50));
      downloadBulkBarcodesPDF(list);
      toast.success(`PDF berisi ${list.length} barcode telah diunduh`);
    } catch (e: any) {
      toast.error("Gagal membuat PDF: " + (e?.message ?? e));
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Data Siswa</h1>
          <p className="text-muted-foreground">Kelola data master siswa peserta uji coba</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleBulkDownload} disabled={bulkBusy || list.length === 0}>
            <FileDown className="h-4 w-4 mr-2" />
            {bulkBusy ? "Menyiapkan..." : "Unduh Semua Barcode (PDF)"}
          </Button>
          <Button onClick={startNew}><Plus className="h-4 w-4 mr-2" />Tambah Siswa</Button>
        </div>
      </div>

      <Card className="shadow-soft">
        <CardHeader><CardTitle>Daftar Siswa ({list.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4">NIS</th>
                  <th className="py-2 pr-4">Nama</th>
                  <th className="py-2 pr-4">Kelas</th>
                  <th className="py-2 pr-4">Gender</th>
                  <th className="py-2 pr-4">Tgl Lahir</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {list.map(s => (
                  <tr key={s.id} className="border-b hover:bg-muted/40">
                    <td className="py-2 pr-4 font-mono text-xs">{s.nis}</td>
                    <td className="py-2 pr-4 font-medium">{s.full_name}</td>
                    <td className="py-2 pr-4">{s.class_name}</td>
                    <td className="py-2 pr-4">{s.gender === "L" ? "Laki-laki" : s.gender === "P" ? "Perempuan" : "-"}</td>
                    <td className="py-2 pr-4">{s.birth_date ?? "-"}</td>
                    <td className="py-2 text-right whitespace-nowrap">
                      <Button size="icon" variant="ghost" title="Lihat barcode" onClick={() => setBarcodeStudent(s)}>
                        <QrCode className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" title="Unduh barcode" onClick={() => downloadStudentBarcodePNG(s)}>
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" title="Edit" onClick={() => startEdit(s)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" title="Hapus" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </td>
                  </tr>
                ))}
                {list.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Belum ada siswa.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit" : "Tambah"} Siswa</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>NIS</Label><Input required value={form.nis} onChange={(e) => setForm({ ...form, nis: e.target.value })} /></div>
              <div><Label>Kelas</Label><Input required value={form.class_name} onChange={(e) => setForm({ ...form, class_name: e.target.value })} /></div>
            </div>
            <div><Label>Nama Lengkap</Label><Input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Jenis Kelamin</Label>
                <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="L">Laki-laki</SelectItem>
                    <SelectItem value="P">Perempuan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Tanggal Lahir</Label><Input type="date" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} /></div>
            </div>
            <p className="text-xs text-muted-foreground">
              Barcode akan otomatis dibuat dari NIS dan dapat diunduh setelah siswa tersimpan.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
              <Button type="submit">Simpan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Per-student barcode preview */}
      <Dialog open={!!barcodeStudent} onOpenChange={(o) => !o && setBarcodeStudent(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Barcode Siswa</DialogTitle>
          </DialogHeader>
          {barcodeStudent && (
            <div className="space-y-3 text-center">
              <div>
                <p className="font-semibold">{barcodeStudent.full_name}</p>
                <p className="text-sm text-muted-foreground">Kelas {barcodeStudent.class_name}</p>
              </div>
              <div className="bg-white rounded-md p-3 flex justify-center">
                <StudentBarcode value={barcodeStudent.nis} />
              </div>
              <Button className="w-full" onClick={() => downloadStudentBarcodePNG(barcodeStudent)}>
                <Download className="h-4 w-4 mr-2" />
                Unduh PNG
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Students;
