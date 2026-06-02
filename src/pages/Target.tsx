import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Target as TargetIcon, Loader2, Calculator, ArrowRight, Save, Plus, Trash2, RefreshCw } from "lucide-react";
import { DEFAULT_FORMULAS, DEFAULT_ACTIVITY, type BmrFormula, loadBmrConfig } from "@/lib/calorie";

interface ActivityRow { id?: string; key: string; label: string; factor: number; sort_order: number; }
interface FormulaRow extends BmrFormula { id?: string; }

const Target = () => {
  // Default macro target
  const [id, setId] = useState<string | null>(null);
  const [form, setForm] = useState({ label: "Default", calories: 2000, protein: 50, carbs: 275, fat: 65, sugar: 50 });
  const [busy, setBusy] = useState(false);

  // BMR formulas + activity factors (editable)
  const [formulas, setFormulas] = useState<FormulaRow[]>([]);
  const [activities, setActivities] = useState<ActivityRow[]>([]);

  // Calculator
  const [calc, setCalc] = useState({
    gender: "L" as "L" | "P",
    age: 12,
    height: 145,
    weight: 38,
    activity: "light",
    proteinPct: 15, carbsPct: 55, fatPct: 30, sugarPct: 10,
  });

  const refresh = async () => {
    const [t, f, a] = await Promise.all([
      supabase.from("nutrition_targets").select("*").eq("is_active", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("bmr_formulas" as any).select("*").order("gender").order("age_min"),
      supabase.from("activity_factors" as any).select("*").order("sort_order"),
    ]);
    if (t.data) {
      setId(t.data.id);
      setForm({
        label: t.data.label, calories: +t.data.calories, protein: +t.data.protein,
        carbs: +t.data.carbs, fat: +t.data.fat, sugar: +t.data.sugar,
      });
    }
    setFormulas(((f.data as any[]) ?? []) as FormulaRow[]);
    setActivities(((a.data as any[]) ?? []) as ActivityRow[]);
  };

  useEffect(() => { refresh(); }, []);

  const pickFormula = (g: "L" | "P", age: number) => {
    const same = formulas.filter((x) => x.gender === g);
    return same.find((x) => age >= x.age_min && age <= x.age_max)
      ?? [...same].sort((a, b) => b.age_max - a.age_max)[0]
      ?? null;
  };

  const result = useMemo(() => {
    const f = pickFormula(calc.gender, calc.age);
    const factor = activities.find((x) => x.key === calc.activity)?.factor ?? 1.375;
    const bmr = f ? f.coef_weight * calc.weight + f.coef_height * calc.height + Number(f.constant) : 0;
    const calories = Math.max(0, Math.round(bmr * Number(factor)));
    return {
      formulaLabel: f?.label ?? "(belum diatur)",
      factor: Number(factor), bmr: Math.round(bmr), calories,
      protein: Math.round((calories * calc.proteinPct / 100) / 4),
      carbs:   Math.round((calories * calc.carbsPct / 100) / 4),
      fat:     Math.round((calories * calc.fatPct / 100) / 9),
      sugar:   Math.round((calories * calc.sugarPct / 100) / 4),
    };
  }, [calc, formulas, activities]);

  const applyToTarget = () => {
    setForm({ ...form, calories: result.calories, protein: result.protein, carbs: result.carbs, fat: result.fat, sugar: result.sugar });
    toast.success("Hasil kalkulator dimasukkan ke target default");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const payload = { ...form, calories: +form.calories, protein: +form.protein, carbs: +form.carbs, fat: +form.fat, sugar: +form.sugar, is_active: true };
    const { error } = id
      ? await supabase.from("nutrition_targets").update(payload).eq("id", id)
      : await supabase.from("nutrition_targets").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Target disimpan");
  };

  // Formula CRUD
  const saveFormula = async (row: FormulaRow) => {
    const payload = {
      label: row.label ?? "", gender: row.gender, age_min: +row.age_min, age_max: +row.age_max,
      coef_weight: +row.coef_weight, coef_height: +row.coef_height, constant: +row.constant,
    };
    const { error } = row.id
      ? await supabase.from("bmr_formulas" as any).update(payload).eq("id", row.id)
      : await supabase.from("bmr_formulas" as any).insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Rumus disimpan"); await refresh(); await loadBmrConfig();
  };
  const deleteFormula = async (rid: string) => {
    if (!confirm("Hapus rumus ini?")) return;
    const { error } = await supabase.from("bmr_formulas" as any).delete().eq("id", rid);
    if (error) return toast.error(error.message);
    toast.success("Dihapus"); await refresh(); await loadBmrConfig();
  };
  const addFormulaRow = () => setFormulas([...formulas, { label: "Baru", gender: "L", age_min: 0, age_max: 0, coef_weight: 0, coef_height: 0, constant: 0 } as FormulaRow]);

  const resetFormulaDefaults = async () => {
    if (!confirm("Reset semua rumus ke default Schofield?")) return;
    await supabase.from("bmr_formulas" as any).delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("bmr_formulas" as any).insert(DEFAULT_FORMULAS.map((f) => ({ ...f })));
    toast.success("Direset ke default Schofield"); await refresh(); await loadBmrConfig();
  };

  // Activity CRUD
  const saveActivity = async (row: ActivityRow) => {
    const payload = { key: row.key, label: row.label, factor: +row.factor, sort_order: +row.sort_order };
    const { error } = row.id
      ? await supabase.from("activity_factors" as any).update(payload).eq("id", row.id)
      : await supabase.from("activity_factors" as any).insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Faktor aktivitas disimpan"); await refresh(); await loadBmrConfig();
  };
  const deleteActivity = async (rid: string) => {
    if (!confirm("Hapus faktor ini?")) return;
    const { error } = await supabase.from("activity_factors" as any).delete().eq("id", rid);
    if (error) return toast.error(error.message);
    toast.success("Dihapus"); await refresh(); await loadBmrConfig();
  };
  const addActivityRow = () => setActivities([...activities, { key: "", label: "", factor: 1, sort_order: (activities.at(-1)?.sort_order ?? 0) + 1 } as ActivityRow]);
  const resetActivityDefaults = async () => {
    if (!confirm("Reset faktor aktivitas ke default?")) return;
    await supabase.from("activity_factors" as any).delete().neq("id", "00000000-0000-0000-0000-000000000000");
    const seed = Object.entries(DEFAULT_ACTIVITY).map(([k, v], i) => ({ key: k, label: k, factor: v, sort_order: i + 1 }));
    await supabase.from("activity_factors" as any).insert(seed);
    toast.success("Direset"); await refresh(); await loadBmrConfig();
  };

  const totalPct = calc.proteinPct + calc.carbsPct + calc.fatPct;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Target Gizi (AKG)</h1>
        <p className="text-muted-foreground">
          Perhitungan kebutuhan kalori siswa menggunakan rumus <strong>Schofield W</strong> berdasar jenis kelamin & umur,
          dikalikan faktor aktivitas. Rumus & faktor di bawah ini dapat diubah admin.
          Bila data tubuh siswa belum lengkap, sistem memakai target default sebagai fallback.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TargetIcon className="h-5 w-5 text-primary" /> Target Default (Fallback)</CardTitle>
            <CardDescription>Dipakai bila data tubuh siswa belum lengkap. Klasifikasi: Kurang &lt; 80%, Ideal 80–110%, Berlebih &gt; 110%.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div><Label>Label</Label><Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Kalori (kkal)</Label><Input type="number" value={form.calories} onChange={(e) => setForm({ ...form, calories: +e.target.value })} /></div>
                <div><Label>Protein (g)</Label><Input type="number" value={form.protein} onChange={(e) => setForm({ ...form, protein: +e.target.value })} /></div>
                <div><Label>Karbohidrat (g)</Label><Input type="number" value={form.carbs} onChange={(e) => setForm({ ...form, carbs: +e.target.value })} /></div>
                <div><Label>Lemak (g)</Label><Input type="number" value={form.fat} onChange={(e) => setForm({ ...form, fat: +e.target.value })} /></div>
                <div><Label>Gula maks (g)</Label><Input type="number" value={form.sugar} onChange={(e) => setForm({ ...form, sugar: +e.target.value })} /></div>
              </div>
              <Button type="submit" disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Simpan Target</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Calculator className="h-5 w-5 text-primary" /> Kalkulator Kebutuhan (Schofield)</CardTitle>
            <CardDescription>Hitung kebutuhan harian berdasarkan rumus Schofield W & faktor aktivitas saat ini.</CardDescription>
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
                <Select value={calc.activity} onValueChange={(v) => setCalc({ ...calc, activity: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {activities.map((a) => (
                      <SelectItem key={a.key || a.id} value={a.key}>{a.label} (×{a.factor})</SelectItem>
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
              {totalPct !== 100 && <p className="text-xs text-destructive mt-1">Total protein+karbo+lemak = {totalPct}% (idealnya 100%)</p>}
            </div>

            <div className="rounded-lg bg-muted p-4 space-y-2">
              <div className="text-xs text-muted-foreground">Rumus terpilih: <strong>{result.formulaLabel}</strong> · BMR: {result.bmr} kkal · Faktor: ×{result.factor}</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between"><span>Kebutuhan Kalori</span><span className="font-semibold">{result.calories} kkal</span></div>
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

      {/* BMR formulas editor */}
      <Card className="shadow-soft">
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle>Rumus BMR (Schofield W)</CardTitle>
              <CardDescription>BMR = (koef. BB × berat) + (koef. TB × tinggi) + konstanta. Dipilih otomatis sesuai jenis kelamin & umur siswa.</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={resetFormulaDefaults}><RefreshCw className="h-4 w-4 mr-1" />Reset Default</Button>
              <Button size="sm" onClick={addFormulaRow}><Plus className="h-4 w-4 mr-1" />Tambah</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Gender</TableHead>
                <TableHead>Umur Min</TableHead>
                <TableHead>Umur Max</TableHead>
                <TableHead>Koef. BB</TableHead>
                <TableHead>Koef. TB</TableHead>
                <TableHead>Konstanta</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {formulas.map((row, i) => (
                <TableRow key={row.id ?? `new-${i}`}>
                  <TableCell><Input value={row.label ?? ""} onChange={(e) => setFormulas(formulas.map((r, j) => j === i ? { ...r, label: e.target.value } : r))} /></TableCell>
                  <TableCell>
                    <Select value={row.gender} onValueChange={(v: "L" | "P") => setFormulas(formulas.map((r, j) => j === i ? { ...r, gender: v } : r))}>
                      <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="L">L</SelectItem><SelectItem value="P">P</SelectItem></SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell><Input type="number" className="w-20" value={row.age_min} onChange={(e) => setFormulas(formulas.map((r, j) => j === i ? { ...r, age_min: +e.target.value } : r))} /></TableCell>
                  <TableCell><Input type="number" className="w-20" value={row.age_max} onChange={(e) => setFormulas(formulas.map((r, j) => j === i ? { ...r, age_max: +e.target.value } : r))} /></TableCell>
                  <TableCell><Input type="number" step="0.001" className="w-28" value={row.coef_weight} onChange={(e) => setFormulas(formulas.map((r, j) => j === i ? { ...r, coef_weight: +e.target.value } : r))} /></TableCell>
                  <TableCell><Input type="number" step="0.001" className="w-28" value={row.coef_height} onChange={(e) => setFormulas(formulas.map((r, j) => j === i ? { ...r, coef_height: +e.target.value } : r))} /></TableCell>
                  <TableCell><Input type="number" step="0.1" className="w-28" value={row.constant} onChange={(e) => setFormulas(formulas.map((r, j) => j === i ? { ...r, constant: +e.target.value } : r))} /></TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="sm" variant="outline" onClick={() => saveFormula(row)}><Save className="h-3 w-3" /></Button>
                    {row.id && <Button size="sm" variant="destructive" onClick={() => deleteFormula(row.id!)}><Trash2 className="h-3 w-3" /></Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Activity factors editor */}
      <Card className="shadow-soft">
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle>Faktor Aktivitas</CardTitle>
              <CardDescription>Kebutuhan = BMR × faktor aktivitas. Default: sangat ringan 1.2 · ringan 1.375 · sedang 1.55 · sangat aktif 1.725 · berat 1.9.</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={resetActivityDefaults}><RefreshCw className="h-4 w-4 mr-1" />Reset Default</Button>
              <Button size="sm" onClick={addActivityRow}><Plus className="h-4 w-4 mr-1" />Tambah</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Faktor</TableHead>
                <TableHead>Urutan</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activities.map((row, i) => (
                <TableRow key={row.id ?? `new-${i}`}>
                  <TableCell><Input className="w-32" value={row.key} onChange={(e) => setActivities(activities.map((r, j) => j === i ? { ...r, key: e.target.value } : r))} /></TableCell>
                  <TableCell><Input value={row.label} onChange={(e) => setActivities(activities.map((r, j) => j === i ? { ...r, label: e.target.value } : r))} /></TableCell>
                  <TableCell><Input type="number" step="0.001" className="w-24" value={row.factor} onChange={(e) => setActivities(activities.map((r, j) => j === i ? { ...r, factor: +e.target.value } : r))} /></TableCell>
                  <TableCell><Input type="number" className="w-20" value={row.sort_order} onChange={(e) => setActivities(activities.map((r, j) => j === i ? { ...r, sort_order: +e.target.value } : r))} /></TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="sm" variant="outline" onClick={() => saveActivity(row)}><Save className="h-3 w-3" /></Button>
                    {row.id && <Button size="sm" variant="destructive" onClick={() => deleteActivity(row.id!)}><Trash2 className="h-3 w-3" /></Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Target;
