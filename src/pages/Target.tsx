import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Target as TargetIcon, Loader2, Calculator, ArrowRight } from "lucide-react";

const ACTIVITY_FACTORS: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: "Sangat ringan (jarang olahraga)",
  light: "Ringan (1-3x/minggu)",
  moderate: "Sedang (3-5x/minggu)",
  active: "Aktif (6-7x/minggu)",
  very_active: "Sangat aktif (atlet)",
};

const Target = () => {
  const [id, setId] = useState<string | null>(null);
  const [form, setForm] = useState({ label: "Default", calories: 2000, protein: 50, carbs: 275, fat: 65, sugar: 50 });
  const [busy, setBusy] = useState(false);

  // Calculator state
  const [calc, setCalc] = useState({
    gender: "L" as "L" | "P",
    age: 15,
    height: 160,
    weight: 50,
    activity: "light" as keyof typeof ACTIVITY_FACTORS,
    proteinPct: 15,
    carbsPct: 55,
    fatPct: 30,
    sugarPct: 10,
  });

  const result = useMemo(() => {
    const { gender, age, height, weight, activity, proteinPct, carbsPct, fatPct, sugarPct } = calc;
    const bmr = gender === "L"
      ? 10 * weight + 6.25 * height - 5 * age + 5
      : 10 * weight + 6.25 * height - 5 * age - 161;
    const calories = Math.round(bmr * (ACTIVITY_FACTORS[activity] ?? 1.375));
    const protein = Math.round((calories * proteinPct / 100) / 4);
    const carbs = Math.round((calories * carbsPct / 100) / 4);
    const fat = Math.round((calories * fatPct / 100) / 9);
    const sugar = Math.round((calories * sugarPct / 100) / 4);
    return { bmr: Math.round(bmr), calories, protein, carbs, fat, sugar };
  }, [calc]);

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

  const applyToTarget = () => {
    setForm({
      ...form,
      calories: result.calories,
      protein: result.protein,
      carbs: result.carbs,
      fat: result.fat,
      sugar: result.sugar,
    });
    toast.success("Hasil kalkulator dimasukkan ke form target");
  };

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

  const totalPct = calc.proteinPct + calc.carbsPct + calc.fatPct;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Target Gizi (AKG)</h1>
        <p className="text-muted-foreground">
          Target umum berlaku untuk seluruh siswa. Untuk siswa yang sudah mengisi data tubuh
          (tinggi, berat, usia, aktivitas), sistem otomatis menghitung target personal via Mifflin-St Jeor.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TargetIcon className="h-5 w-5 text-primary" /> Target Aktif (Default)</CardTitle>
            <CardDescription>
              Dipakai sebagai fallback bila data tubuh siswa belum lengkap. Klasifikasi: Kurang &lt; 80%, Ideal 80–110%, Berlebih &gt; 110%.
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

        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Calculator className="h-5 w-5 text-primary" /> Kalkulator Gizi</CardTitle>
            <CardDescription>
              Hitung kebutuhan harian berdasarkan rumus Mifflin-St Jeor. Hasilnya dapat diterapkan ke target default.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Jenis Kelamin</Label>
                <Select value={calc.gender} onValueChange={(v: "L" | "P") => setCalc({ ...calc, gender: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="L">Laki-laki</SelectItem>
                    <SelectItem value="P">Perempuan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Usia (tahun)</Label><Input type="number" value={calc.age} onChange={(e) => setCalc({ ...calc, age: +e.target.value })} /></div>
              <div><Label>Tinggi (cm)</Label><Input type="number" value={calc.height} onChange={(e) => setCalc({ ...calc, height: +e.target.value })} /></div>
              <div><Label>Berat (kg)</Label><Input type="number" value={calc.weight} onChange={(e) => setCalc({ ...calc, weight: +e.target.value })} /></div>
              <div className="col-span-2">
                <Label>Tingkat Aktivitas</Label>
                <Select value={calc.activity} onValueChange={(v) => setCalc({ ...calc, activity: v as keyof typeof ACTIVITY_FACTORS })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ACTIVITY_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="text-sm font-medium mb-2">Distribusi Makronutrien (%)</div>
              <div className="grid grid-cols-4 gap-2">
                <div><Label className="text-xs">Protein</Label><Input type="number" value={calc.proteinPct} onChange={(e) => setCalc({ ...calc, proteinPct: +e.target.value })} /></div>
                <div><Label className="text-xs">Karbo</Label><Input type="number" value={calc.carbsPct} onChange={(e) => setCalc({ ...calc, carbsPct: +e.target.value })} /></div>
                <div><Label className="text-xs">Lemak</Label><Input type="number" value={calc.fatPct} onChange={(e) => setCalc({ ...calc, fatPct: +e.target.value })} /></div>
                <div><Label className="text-xs">Gula maks</Label><Input type="number" value={calc.sugarPct} onChange={(e) => setCalc({ ...calc, sugarPct: +e.target.value })} /></div>
              </div>
              {totalPct !== 100 && (
                <p className="text-xs text-destructive mt-1">Total protein+karbo+lemak = {totalPct}% (idealnya 100%)</p>
              )}
            </div>

            <div className="rounded-lg bg-muted p-4 space-y-2">
              <div className="text-xs text-muted-foreground">BMR: {result.bmr} kkal · Faktor aktivitas: ×{ACTIVITY_FACTORS[calc.activity]}</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between"><span>Kalori</span><span className="font-semibold">{result.calories} kkal</span></div>
                <div className="flex justify-between"><span>Protein</span><span className="font-semibold">{result.protein} g</span></div>
                <div className="flex justify-between"><span>Karbohidrat</span><span className="font-semibold">{result.carbs} g</span></div>
                <div className="flex justify-between"><span>Lemak</span><span className="font-semibold">{result.fat} g</span></div>
                <div className="flex justify-between col-span-2"><span>Gula maks</span><span className="font-semibold">{result.sugar} g</span></div>
              </div>
            </div>

            <Button type="button" variant="secondary" onClick={applyToTarget} className="w-full">
              Terapkan ke Target Default <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Target;
