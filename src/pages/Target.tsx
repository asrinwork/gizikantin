import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Target as TargetIcon, Loader2 } from "lucide-react";

const Target = () => {
  const [id, setId] = useState<string | null>(null);
  const [form, setForm] = useState({ label: "Default", calories: 2000, protein: 50, carbs: 275, fat: 65, sugar: 50 });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("nutrition_targets").select("*").eq("is_active", true)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (data) {
        setId(data.id);
        setForm({
          label: data.label, calories: +data.calories, protein: +data.protein,
          carbs: +data.carbs, fat: +data.fat, sugar: +data.sugar,
        });
      }
    })();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const payload = {
      label: form.label,
      calories: +form.calories, protein: +form.protein,
      carbs: +form.carbs, fat: +form.fat, sugar: +form.sugar,
      is_active: true,
    };
    let error;
    if (id) ({ error } = await supabase.from("nutrition_targets").update(payload).eq("id", id));
    else ({ error } = await supabase.from("nutrition_targets").insert(payload));
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Target disimpan");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Target Gizi (AKG)</h1>
        <p className="text-muted-foreground">Atur target asupan harian yang berlaku untuk semua siswa</p>
      </div>

      <Card className="shadow-soft max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><TargetIcon className="h-5 w-5 text-primary" /> Target Aktif</CardTitle>
          <CardDescription>
            Klasifikasi: Kurang &lt; 80%, Ideal 80–110%, Berlebih &gt; 110% dari target.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label>Label</Label>
              <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Kalori (kkal)</Label><Input type="number" value={form.calories} onChange={(e) => setForm({ ...form, calories: +e.target.value })} /></div>
              <div><Label>Protein (g)</Label><Input type="number" value={form.protein} onChange={(e) => setForm({ ...form, protein: +e.target.value })} /></div>
              <div><Label>Karbohidrat (g)</Label><Input type="number" value={form.carbs} onChange={(e) => setForm({ ...form, carbs: +e.target.value })} /></div>
              <div><Label>Lemak (g)</Label><Input type="number" value={form.fat} onChange={(e) => setForm({ ...form, fat: +e.target.value })} /></div>
              <div><Label>Gula maks (g)</Label><Input type="number" value={form.sugar} onChange={(e) => setForm({ ...form, sugar: +e.target.value })} /></div>
            </div>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Simpan Target
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Target;
