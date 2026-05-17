import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { parseCSV } from "@/lib/csv";
import { Loader2, Upload, FileSpreadsheet, Download } from "lucide-react";
import { toast } from "sonner";

interface Props { open: boolean; onOpenChange: (o: boolean) => void; onDone?: () => void; }

const SAMPLE = `nis,nama,kelas,gender,tgl_lahir,tinggi_cm,berat_kg,aktivitas
2024001,Budi Santoso,7A,L,2012-04-15,150,42,light
2024002,Siti Aminah,7A,P,2012-06-20,148,40,moderate`;

export const StudentImportDialog = ({ open, onOpenChange, onDone }: Props) => {
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (f: File) => {
    const text = await f.text();
    const parsed = parseCSV(text);
    const mapped = parsed.map((r) => ({
      nis: r.nis ?? r.NIS ?? "",
      full_name: r.nama ?? r.full_name ?? r.name ?? "",
      class_name: r.kelas ?? r.class_name ?? "",
      gender: ((r.gender || "L").toUpperCase().startsWith("P") ? "P" : "L") as "L" | "P",
      birth_date: r.tgl_lahir || r.birth_date || null,
      height_cm: r.tinggi_cm ? Number(r.tinggi_cm) : null,
      weight_kg: r.berat_kg ? Number(r.berat_kg) : null,
      activity_level: (r.aktivitas || r.activity_level || "light").toLowerCase(),
    }));
    setRows(mapped);
    setResults([]);
  };

  const submit = async () => {
    if (rows.length === 0) return toast.error("Tidak ada data");
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("bulk-create-students", { body: { students: rows } });
    setBusy(false);
    if (error) return toast.error("Gagal: " + error.message);
    const res = data?.results ?? [];
    setResults(res);
    const ok = res.filter((r: any) => r.ok).length;
    toast.success(`${ok}/${res.length} siswa berhasil diproses`);
    onDone?.();
  };

  const downloadSample = () => {
    const blob = new Blob([SAMPLE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "template-siswa.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setRows([]); setResults([]); } onOpenChange(o); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Siswa dari CSV</DialogTitle>
          <DialogDescription>
            Kolom: <code>nis, nama, kelas, gender, tgl_lahir, tinggi_cm, berat_kg, aktivitas</code>.
            Akun login dibuat otomatis (email: <code>NIS@sekolah.local</code>, password: NIS — dipanjangkan ke 6 karakter dengan '0' jika kurang).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Button variant="outline" onClick={downloadSample}>
              <Download className="h-4 w-4 mr-2" /> Unduh template
            </Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" /> Pilih file CSV
            </Button>
            <input
              ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>

          {rows.length > 0 && results.length === 0 && (
            <div className="rounded-md border max-h-64 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr><th className="p-2 text-left">NIS</th><th className="p-2 text-left">Nama</th><th className="p-2 text-left">Kelas</th><th className="p-2 text-left">TB/BB</th></tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2 font-mono text-xs">{r.nis}</td>
                      <td className="p-2">{r.full_name}</td>
                      <td className="p-2">{r.class_name}</td>
                      <td className="p-2">{r.height_cm ?? "-"} / {r.weight_kg ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {results.length > 0 && (
            <div className="rounded-md border max-h-64 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr><th className="p-2 text-left">NIS</th><th className="p-2 text-left">Status</th><th className="p-2 text-left">Info</th></tr>
                </thead>
                <tbody>
                  {results.map((r: any, i: number) => (
                    <tr key={i} className="border-t">
                      <td className="p-2 font-mono text-xs">{r.nis}</td>
                      <td className="p-2">{r.ok ? "✅ OK" : "❌ Gagal"}</td>
                      <td className="p-2 text-xs">{r.ok ? `${r.email} / ${r.password}` : r.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {rows.length === 0 && results.length === 0 && (
            <div className="rounded-md border-2 border-dashed p-8 text-center text-sm text-muted-foreground">
              <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 opacity-50" />
              Belum ada file. Unduh template untuk melihat format.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Tutup</Button>
          <Button onClick={submit} disabled={busy || rows.length === 0 || results.length > 0}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Buat Akun ({rows.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
