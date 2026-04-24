import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, ShoppingCart, Trash2, ScanLine } from "lucide-react";
import { formatNum } from "@/lib/nutrition";
import { BarcodeScanner } from "@/components/BarcodeScanner";

interface Student { id: string; nis: string; full_name: string; class_name: string; }
interface Food { id: string; name: string; calories: number; price: number; }
interface TxRow {
  id: string; quantity: number; consumed_at: string;
  students: { full_name: string; class_name: string } | null;
  foods: { name: string; calories: number } | null;
}

const Transactions = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [foods, setFoods] = useState<Food[]>([]);
  const [recent, setRecent] = useState<TxRow[]>([]);
  const [studentId, setStudentId] = useState("");
  const [foodId, setFoodId] = useState("");
  const [qty, setQty] = useState("1");
  const [busy, setBusy] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  const load = async () => {
    const [s, f, r] = await Promise.all([
      supabase.from("students").select("id,nis,full_name,class_name").order("class_name").order("full_name"),
      supabase.from("foods").select("id,name,calories,price").order("name"),
      supabase.from("transactions")
        .select("id,quantity,consumed_at,students(full_name,class_name),foods(name,calories)")
        .order("consumed_at", { ascending: false }).limit(20),
    ]);
    setStudents((s.data ?? []) as any);
    setFoods((f.data ?? []) as any);
    setRecent((r.data ?? []) as any);
  };
  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !foodId) return toast.error("Pilih siswa dan makanan");
    setBusy(true);
    const { error } = await supabase.from("transactions").insert({
      student_id: studentId, food_id: foodId, quantity: +qty || 1, recorded_by: user?.id,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Transaksi tercatat");
    setFoodId(""); setQty("1");
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Hapus transaksi ini?")) return;
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Dihapus");
    load();
  };

  const handleScanned = (code: string) => {
    const trimmed = code.trim();
    const found = students.find((s) => s.nis === trimmed);
    if (!found) {
      toast.error(`Siswa dengan NIS "${trimmed}" tidak ditemukan`);
      return;
    }
    setStudentId(found.id);
    toast.success(`Siswa terpilih: ${found.full_name} (${found.class_name})`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Transaksi Kantin</h1>
        <p className="text-muted-foreground">Catat makanan yang dikonsumsi siswa</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShoppingCart className="h-5 w-5 text-primary" /> Transaksi Baru</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Siswa</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setScannerOpen(true)}
                  >
                    <ScanLine className="h-4 w-4 mr-1.5" />
                    Scan Barcode
                  </Button>
                </div>
                <Select value={studentId} onValueChange={setStudentId}>
                  <SelectTrigger><SelectValue placeholder="Pilih siswa atau scan barcode" /></SelectTrigger>
                  <SelectContent>
                    {students.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.full_name} — {s.class_name} ({s.nis})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Makanan</Label>
                <Select value={foodId} onValueChange={setFoodId}>
                  <SelectTrigger><SelectValue placeholder="Pilih makanan" /></SelectTrigger>
                  <SelectContent>
                    {foods.map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.name} — {formatNum(f.calories,0)} kkal</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Jumlah (porsi)</Label>
                <Input type="number" min="0.5" step="0.5" value={qty} onChange={(e) => setQty(e.target.value)} />
              </div>
              <Button type="submit" disabled={busy} className="w-full">
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Simpan Transaksi
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader><CardTitle>Transaksi Terbaru</CardTitle></CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="text-muted-foreground text-sm">Belum ada transaksi.</p>
            ) : (
              <ul className="divide-y">
                {recent.map(t => (
                  <li key={t.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{t.students?.full_name} <span className="text-muted-foreground">• {t.students?.class_name}</span></p>
                      <p className="text-xs text-muted-foreground truncate">{t.foods?.name} × {t.quantity} ({formatNum((t.foods?.calories ?? 0) * t.quantity, 0)} kkal)</p>
                      <p className="text-[11px] text-muted-foreground">{new Date(t.consumed_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}</p>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => remove(t.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Transactions;
