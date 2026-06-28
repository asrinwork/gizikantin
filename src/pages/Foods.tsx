import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Upload, Download, ImageIcon, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { formatNum } from "@/lib/nutrition";
import { logAudit } from "@/lib/audit";
import { DataTable } from "@/components/DataTable";
import { parseCSV } from "@/lib/csv";

interface Food {
  id: string;
  name: string;
  calories: number; protein: number; carbs: number; fat: number; sugar: number; price: number;
  image_url?: string | null;
}

const empty = { name: "", calories: 0, protein: 0, carbs: 0, fat: 0, sugar: 0, price: 0, image_url: "" };

const Foods = () => {
  const { user } = useAuth();
  const [foods, setFoods] = useState<Food[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Food | null>(null);
  const [form, setForm] = useState<any>(empty);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResults, setBulkResults] = useState<{ ok: number; failed: { name: string; error: string }[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const [imgBusy, setImgBusy] = useState(false);

  const handleFile = async (f: File) => {
    const text = await f.text();
    setBulkText(text);
    setBulkResults(null);
    toast.success(`${f.name} dimuat`);
  };

  const load = async () => {
    const { data } = await supabase.from("foods").select("*").order("name");
    setFoods((data ?? []) as any);
  };
  useEffect(() => { load(); }, []);

  const startNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const startEdit = (f: Food) => { setEditing(f); setForm(f); setOpen(true); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: form.name,
      calories: +form.calories, protein: +form.protein, carbs: +form.carbs, fat: +form.fat, sugar: +form.sugar, price: +form.price,
      image_url: form.image_url || null,
    };
    if (editing) {
      const { error } = await supabase.from("foods").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      await logAudit("update_food", "food", editing.id, payload);
      toast.success("Makanan diperbarui");
    } else {
      const { data, error } = await supabase.from("foods").insert({ ...payload, created_by: user?.id }).select("id").single();
      if (error) return toast.error(error.message);
      await logAudit("create_food", "food", data?.id ?? null, payload);
      toast.success("Makanan ditambahkan");
    }
    setOpen(false);
    load();
  };

  const uploadImage = async (file: File) => {
    setImgBusy(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user?.id ?? "anon"}/${Date.now()}.${ext}`;
      const { error: ue } = await supabase.storage.from("food-images").upload(path, file, { upsert: true, contentType: file.type });
      if (ue) throw ue;
      // Signed URL (1 year) since bucket is private
      const { data: signed, error: se } = await supabase.storage.from("food-images").createSignedUrl(path, 60 * 60 * 24 * 365);
      if (se) throw se;
      setForm((f: any) => ({ ...f, image_url: signed.signedUrl }));
      toast.success("Gambar diupload");
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal upload");
    } finally { setImgBusy(false); }
  };

  const remove = async (id: string) => {
    if (!confirm("Hapus makanan ini?")) return;
    const { error } = await supabase.from("foods").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await logAudit("delete_food", "food", id, {});
    toast.success("Dihapus");
    load();
  };

  const downloadTemplate = () => {
    const csv = "name,calories,protein,carbs,fat,sugar,price\nNasi Ayam Goreng,520,28,60,18,2,15000\nJus Jeruk,110,1,26,0,22,8000\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "menu_template.csv"; a.click();
  };

  const runBulk = async () => {
    const rows = parseCSV(bulkText);
    if (!rows.length) return toast.error("CSV kosong / tidak valid");
    setBulkBusy(true);
    let ok = 0; const failed: { name: string; error: string }[] = [];
    for (const r of rows) {
      const name = (r.name || "").trim();
      if (!name) { failed.push({ name: "(kosong)", error: "name wajib" }); continue; }
      const payload = {
        name,
        calories: Number(r.calories) || 0,
        protein: Number(r.protein) || 0,
        carbs: Number(r.carbs) || 0,
        fat: Number(r.fat) || 0,
        sugar: Number(r.sugar) || 0,
        price: Number(r.price) || 0,
        created_by: user?.id,
      };
      const { error } = await supabase.from("foods").insert(payload);
      if (error) failed.push({ name, error: error.message }); else ok++;
    }
    setBulkBusy(false);
    setBulkResults({ ok, failed });
    if (ok) { await logAudit("bulk_create_foods", "food", null, { ok, failed: failed.length }); toast.success(`${ok} menu ditambahkan`); load(); }
    if (failed.length && !ok) toast.error(`${failed.length} baris gagal`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Data Makanan</h1>
          <p className="text-muted-foreground">Kelola menu kantin dan informasi gizinya</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setBulkText(""); setBulkResults(null); setBulkOpen(true); }}>
            <Upload className="h-4 w-4 mr-2" />Import CSV
          </Button>
          <Button onClick={startNew}><Plus className="h-4 w-4 mr-2" />Tambah Makanan</Button>
        </div>
      </div>

      <Card className="shadow-soft">
        <CardHeader><CardTitle>Daftar Menu ({foods.length})</CardTitle></CardHeader>
        <CardContent>
          <DataTable
            data={foods}
            rowKey={(f) => f.id}
            searchPlaceholder="Cari makanan..."
            emptyMessage="Belum ada makanan."
            columns={[
              { key: "name", header: "Nama", accessor: (f) => f.name, cell: (f) => <span className="font-medium">{f.name}</span> },
              { key: "calories", header: "Kal", accessor: (f) => f.calories, cell: (f) => formatNum(f.calories, 0) },
              { key: "protein", header: "Prot", accessor: (f) => f.protein, cell: (f) => formatNum(f.protein) },
              { key: "carbs", header: "Karbo", accessor: (f) => f.carbs, cell: (f) => formatNum(f.carbs) },
              { key: "fat", header: "Lemak", accessor: (f) => f.fat, cell: (f) => formatNum(f.fat) },
              { key: "sugar", header: "Gula", accessor: (f) => f.sugar, cell: (f) => formatNum(f.sugar) },
              { key: "price", header: "Harga", accessor: (f) => f.price, cell: (f) => `Rp${formatNum(f.price, 0)}` },
              {
                key: "act", header: "", sortable: false, align: "right",
                cell: (f) => (
                  <div className="whitespace-nowrap">
                    <Button size="icon" variant="ghost" onClick={() => startEdit(f)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(f.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                ),
              },
            ]}
          />
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit" : "Tambah"} Makanan</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div><Label>Nama</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Kalori (kkal)</Label><Input type="number" step="0.1" value={form.calories} onChange={(e) => setForm({ ...form, calories: e.target.value })} /></div>
              <div><Label>Protein (g)</Label><Input type="number" step="0.1" value={form.protein} onChange={(e) => setForm({ ...form, protein: e.target.value })} /></div>
              <div><Label>Karbohidrat (g)</Label><Input type="number" step="0.1" value={form.carbs} onChange={(e) => setForm({ ...form, carbs: e.target.value })} /></div>
              <div><Label>Lemak (g)</Label><Input type="number" step="0.1" value={form.fat} onChange={(e) => setForm({ ...form, fat: e.target.value })} /></div>
              <div><Label>Gula (g)</Label><Input type="number" step="0.1" value={form.sugar} onChange={(e) => setForm({ ...form, sugar: e.target.value })} /></div>
              <div><Label>Harga (Rp)</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
              <Button type="submit">Simpan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Import CSV Menu</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Kolom: <code>name,calories,protein,carbs,fat,sugar,price</code>
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-2" />Unduh template
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />Pilih file CSV
              </Button>
              <input
                ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </div>
            <textarea
              className="w-full h-40 rounded-md border border-input bg-background p-2 font-mono text-xs"
              placeholder="Tempel isi CSV di sini atau klik 'Pilih file CSV'"
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
            />
            {bulkResults && (
              <div className="rounded-md border p-2 max-h-40 overflow-auto text-xs space-y-0.5">
                <div className="text-emerald-700 font-medium">Berhasil: {bulkResults.ok}</div>
                {bulkResults.failed.map((f, i) => (
                  <div key={i} className="text-destructive">{f.name} — {f.error}</div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>Tutup</Button>
            <Button onClick={runBulk} disabled={bulkBusy}>{bulkBusy ? "Memproses..." : "Proses"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Foods;
