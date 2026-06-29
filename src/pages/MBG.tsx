import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2, Save, Utensils } from "lucide-react";
import { loadBmrConfig, getSchoolShare } from "@/lib/calorie";

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const MBG = () => {
  const [share, setShare] = useState(65);
  const [shareLoaded, setShareLoaded] = useState(false);
  const [savingShare, setSavingShare] = useState(false);

  const [entryDate, setEntryDate] = useState(todayStr());
  const [calories, setCalories] = useState<string>("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const [entries, setEntries] = useState<any[]>([]);

  const loadAll = async () => {
    const { data: ss } = await supabase.from("school_settings" as any).select("school_share_pct").eq("id", 1).maybeSingle();
    if (ss) {
      setShare(Math.round(Number((ss as any).school_share_pct) * 100));
    }
    setShareLoaded(true);
    const { data } = await supabase.from("mbg_entries" as any).select("*").order("entry_date", { ascending: false }).limit(60);
    setEntries(data ?? []);
  };

  useEffect(() => { loadAll(); }, []);

  const saveShare = async () => {
    if (share <= 0 || share > 100) return toast.error("Persentase harus antara 1–100");
    setSavingShare(true);
    const { error } = await supabase.from("school_settings" as any).update({ school_share_pct: share / 100, updated_at: new Date().toISOString() }).eq("id", 1);
    setSavingShare(false);
    if (error) return toast.error(error.message);
    await loadBmrConfig();
    toast.success("Persentase jatah sekolah disimpan");
  };

  const addEntry = async () => {
    const cal = Number(calories);
    if (!cal || cal <= 0) return toast.error("Kalori harus lebih dari 0");
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("mbg_entries" as any).insert({
      entry_date: entryDate, calories: cal, note: note || null, created_by: u.user?.id ?? null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    setCalories(""); setNote("");
    toast.success("Entri MBG ditambahkan untuk semua siswa");
    loadAll();
  };

  const remove = async (id: string) => {
    if (!confirm("Hapus entri MBG ini?")) return;
    const { error } = await supabase.from("mbg_entries" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Dihapus");
    loadAll();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">MBG & Jatah Sekolah</h1>
        <p className="text-muted-foreground">Kelola kalori Makanan Bergizi Gratis dan persentase jatah kalori sekolah.</p>
      </div>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Persentase Jatah Kalori Sekolah</CardTitle>
          <p className="text-sm text-muted-foreground">Karena siswa tidak 24 jam di sekolah, batas kalori yang ditampilkan adalah persentase ini dari total kebutuhan harian.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-end gap-3 max-w-md">
            <div className="flex-1">
              <Label htmlFor="share">Persentase (%)</Label>
              <Input id="share" type="number" min={1} max={100} value={share} onChange={(e) => setShare(Number(e.target.value))} disabled={!shareLoaded} />
            </div>
            <Button onClick={saveShare} disabled={savingShare}><Save className="h-4 w-4 mr-2" />Simpan</Button>
          </div>
          <p className="text-xs text-muted-foreground">Saat ini sistem aktif menggunakan {Math.round(getSchoolShare() * 100)}% dari kebutuhan harian.</p>
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Utensils className="h-5 w-5 text-primary" /> Tambah Entri MBG</CardTitle>
          <p className="text-sm text-muted-foreground">Kalori MBG yang ditambahkan akan dihitung sebagai konsumsi untuk semua siswa pada tanggal terkait.</p>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div>
            <Label>Tanggal</Label>
            <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
          </div>
          <div>
            <Label>Kalori (kkal)</Label>
            <Input type="number" min={0} value={calories} onChange={(e) => setCalories(e.target.value)} placeholder="cth: 450" />
          </div>
          <div className="md:col-span-2">
            <Label>Catatan (opsional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="cth: Nasi ayam + sayur + buah" />
          </div>
          <div className="md:col-span-4">
            <Button onClick={addEntry} disabled={saving}><Save className="h-4 w-4 mr-2" />Simpan Entri</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader><CardTitle>Riwayat MBG</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Belum ada entri MBG.</p>
          ) : (
            entries.map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded-md border p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{e.entry_date}</Badge>
                    <span className="font-semibold">{Number(e.calories).toLocaleString("id-ID")} kkal</span>
                  </div>
                  {e.note && <p className="text-xs text-muted-foreground mt-1">{e.note}</p>}
                </div>
                <Button variant="ghost" size="icon" onClick={() => remove(e.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MBG;
