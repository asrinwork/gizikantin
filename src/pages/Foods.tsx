import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatNum } from "@/lib/nutrition";
import { logAudit } from "@/lib/audit";

interface Food {
  id: string;
  name: string;
  calories: number; protein: number; carbs: number; fat: number; sugar: number; price: number;
}

const empty = { name: "", calories: 0, protein: 0, carbs: 0, fat: 0, sugar: 0, price: 0 };

const Foods = () => {
  const { user } = useAuth();
  const [foods, setFoods] = useState<Food[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Food | null>(null);
  const [form, setForm] = useState<any>(empty);

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

  const remove = async (id: string) => {
    if (!confirm("Hapus makanan ini?")) return;
    const { error } = await supabase.from("foods").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await logAudit("delete_food", "food", id, {});
    toast.success("Dihapus");
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Data Makanan</h1>
          <p className="text-muted-foreground">Kelola menu kantin dan informasi gizinya</p>
        </div>
        <Button onClick={startNew}><Plus className="h-4 w-4 mr-2" />Tambah Makanan</Button>
      </div>

      <Card className="shadow-soft">
        <CardHeader><CardTitle>Daftar Menu ({foods.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4">Nama</th>
                  <th className="py-2 pr-4">Kal</th>
                  <th className="py-2 pr-4">Prot</th>
                  <th className="py-2 pr-4">Karbo</th>
                  <th className="py-2 pr-4">Lemak</th>
                  <th className="py-2 pr-4">Gula</th>
                  <th className="py-2 pr-4">Harga</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {foods.map(f => (
                  <tr key={f.id} className="border-b hover:bg-muted/40">
                    <td className="py-2 pr-4 font-medium">{f.name}</td>
                    <td className="py-2 pr-4">{formatNum(f.calories,0)}</td>
                    <td className="py-2 pr-4">{formatNum(f.protein)}</td>
                    <td className="py-2 pr-4">{formatNum(f.carbs)}</td>
                    <td className="py-2 pr-4">{formatNum(f.fat)}</td>
                    <td className="py-2 pr-4">{formatNum(f.sugar)}</td>
                    <td className="py-2 pr-4">Rp{formatNum(f.price,0)}</td>
                    <td className="py-2 text-right whitespace-nowrap">
                      <Button size="icon" variant="ghost" onClick={() => startEdit(f)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(f.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </td>
                  </tr>
                ))}
                {foods.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">Belum ada makanan.</td></tr>}
              </tbody>
            </table>
          </div>
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
    </div>
  );
};

export default Foods;
