import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  computeStatus, formatNum, NutritionTarget, NutritionTotals,
  overallStatus, statusColor, statusEmoji, statusLabel,
} from "@/lib/nutrition";
import { Search, Users, TrendingUp, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { calcDailyTarget, loadBmrConfig, ActivityLevel } from "@/lib/calorie";

interface Student {
  id: string; nis: string; full_name: string; class_name: string;
  gender?: "L"|"P"|null; birth_date?: string|null; height_cm?: number|null; weight_kg?: number|null; activity_level?: ActivityLevel|null;
}
interface Food { id: string; name: string; calories: number; protein: number; carbs: number; fat: number; sugar: number; }
interface Tx { id: string; student_id: string; food_id: string; quantity: number; consumed_at: string; }

const todayRange = () => {
  const start = new Date(); start.setHours(0,0,0,0);
  const end = new Date(); end.setHours(23,59,59,999);
  return { start: start.toISOString(), end: end.toISOString() };
};

const Dashboard = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [foods, setFoods] = useState<Food[]>([]);
  const [txToday, setTxToday] = useState<Tx[]>([]);
  const [fallbackTarget, setFallbackTarget] = useState<NutritionTarget>({ calories: 2000, protein: 50, carbs: 275, fat: 65, sugar: 50 });
  const [search, setSearch] = useState("");
  const [detailStudent, setDetailStudent] = useState<Student | null>(null);
  const [history, setHistory] = useState<Tx[]>([]);

  useEffect(() => {
    const load = async () => {
      await loadBmrConfig();
      const { start, end } = todayRange();
      const [s, f, t, n] = await Promise.all([
        supabase.from("students").select("id,nis,full_name,class_name,gender,birth_date,height_cm,weight_kg,activity_level").order("class_name").order("full_name"),
        supabase.from("foods").select("id,name,calories,protein,carbs,fat,sugar"),
        supabase.from("transactions").select("id,student_id,food_id,quantity,consumed_at").gte("consumed_at", start).lte("consumed_at", end),
        supabase.from("nutrition_targets").select("*").eq("is_active", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      setStudents((s.data ?? []) as any);
      setFoods((f.data ?? []) as any);
      setTxToday((t.data ?? []) as any);
      if (n.data) setFallbackTarget({ calories: +n.data.calories, protein: +n.data.protein, carbs: +n.data.carbs, fat: +n.data.fat, sugar: +n.data.sugar });
    };
    load();
  }, []);

  const targetFor = (s: Student): NutritionTarget => calcDailyTarget(s as any, fallbackTarget);


  const foodMap = useMemo(() => Object.fromEntries(foods.map(f => [f.id, f])), [foods]);

  const totalsForStudent = (studentId: string, txs: Tx[]): NutritionTotals => {
    return txs
      .filter(t => t.student_id === studentId)
      .reduce<NutritionTotals>((acc, t) => {
        const f = foodMap[t.food_id];
        if (!f) return acc;
        const q = +t.quantity;
        return {
          calories: acc.calories + +f.calories * q,
          protein: acc.protein + +f.protein * q,
          carbs: acc.carbs + +f.carbs * q,
          fat: acc.fat + +f.fat * q,
          sugar: acc.sugar + +f.sugar * q,
        };
      }, { calories: 0, protein: 0, carbs: 0, fat: 0, sugar: 0 });
  };

  const filtered = students.filter(s =>
    s.full_name.toLowerCase().includes(search.toLowerCase()) ||
    s.nis.includes(search) ||
    s.class_name.toLowerCase().includes(search.toLowerCase())
  );

  const stats = useMemo(() => {
    let ideal = 0, kurang = 0, berlebih = 0;
    students.forEach(s => {
      const tot = totalsForStudent(s.id, txToday);
      const st = overallStatus(tot, targetFor(s));
      if (st === "ideal") ideal++; else if (st === "kurang") kurang++; else berlebih++;
    });
    return { ideal, kurang, berlebih, total: students.length };
  }, [students, txToday, foodMap, fallbackTarget]);


  const openDetail = async (s: Student) => {
    setDetailStudent(s);
    const since = new Date(); since.setDate(since.getDate() - 7);
    const { data } = await supabase
      .from("transactions")
      .select("id,student_id,food_id,quantity,consumed_at")
      .eq("student_id", s.id)
      .gte("consumed_at", since.toISOString())
      .order("consumed_at", { ascending: false });
    setHistory((data ?? []) as any);
  };

  const detailTotals = detailStudent ? totalsForStudent(detailStudent.id, txToday) : null;
  const detailTarget = detailStudent ? targetFor(detailStudent) : fallbackTarget;


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard Gizi</h1>
        <p className="text-muted-foreground">Pemantauan asupan gizi siswa hari ini</p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Users className="h-5 w-5" />} label="Total Siswa" value={stats.total} tone="primary" />
        <StatCard icon={<CheckCircle2 className="h-5 w-5" />} label="Ideal" value={stats.ideal} tone="success" />
        <StatCard icon={<AlertTriangle className="h-5 w-5" />} label="Kurang" value={stats.kurang} tone="warning" />
        <StatCard icon={<XCircle className="h-5 w-5" />} label="Berlebih" value={stats.berlebih} tone="destructive" />
      </div>

      <Card className="shadow-soft">
        <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Status Gizi Harian Siswa
          </CardTitle>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Cari nama / NIS / kelas" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(s => {
              const tot = totalsForStudent(s.id, txToday);
              const target = targetFor(s);
              const st = overallStatus(tot, target);
              const pct = Math.min(200, target.calories > 0 ? (tot.calories / target.calories) * 100 : 0);

              return (
                <Dialog key={s.id} onOpenChange={(o) => !o && setDetailStudent(null)}>
                  <DialogTrigger asChild>
                    <button onClick={() => openDetail(s)} className="text-left rounded-xl border bg-card p-4 transition-all hover:shadow-elevated hover:border-primary/40">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{s.full_name}</p>
                          <p className="text-xs text-muted-foreground">{s.nis} • Kelas {s.class_name}</p>
                        </div>
                        <Badge className={statusColor(st)}>{statusEmoji(st)} {statusLabel(st)}</Badge>
                      </div>
                      <div className="mt-3 space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Kalori</span>
                          <span className="font-medium">{formatNum(tot.calories, 0)} / {formatNum(target.calories, 0)} kkal</span>
                        </div>
                        <Progress value={Math.min(100, pct)} className="h-2" />
                      </div>
                    </button>
                  </DialogTrigger>
                  {detailStudent?.id === s.id && detailTotals && (
                    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>{s.full_name}</DialogTitle>
                        <p className="text-sm text-muted-foreground">{s.nis} • Kelas {s.class_name}</p>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="rounded-xl gradient-soft p-4">
                          <p className="text-xs uppercase text-muted-foreground font-semibold">Status hari ini</p>
                          <div className="mt-1 flex items-center gap-2">
                            <Badge className={statusColor(overallStatus(detailTotals, detailTarget))}>
                              {statusEmoji(overallStatus(detailTotals, detailTarget))} {statusLabel(overallStatus(detailTotals, detailTarget))}
                            </Badge>
                          </div>
                        </div>

                        <div className="space-y-3">
                          {(["calories","protein","carbs","fat","sugar"] as const).map(k => {
                            const labels: any = { calories: "Kalori (kkal)", protein: "Protein (g)", carbs: "Karbohidrat (g)", fat: "Lemak (g)", sugar: "Gula (g)" };
                            const v = detailTotals[k]; const tg = detailTarget[k];
                            const pct = tg > 0 ? Math.min(150, (v / tg) * 100) : 0;
                            const st2 = computeStatus(v, tg);
                            return (
                              <div key={k}>
                                <div className="flex justify-between text-sm mb-1">
                                  <span>{labels[k]}</span>
                                  <span className="font-medium">{formatNum(v)} / {formatNum(tg)} <Badge variant="outline" className="ml-1">{statusLabel(st2)}</Badge></span>
                                </div>
                                <Progress value={Math.min(100, pct)} className="h-2" />
                              </div>
                            );
                          })}
                        </div>

                        <div>
                          <h3 className="font-semibold mb-2 text-sm">Riwayat 7 hari terakhir</h3>
                          {history.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Belum ada transaksi.</p>
                          ) : (
                            <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                              {history.map(h => {
                                const f = foodMap[h.food_id];
                                return (
                                  <li key={h.id} className="text-sm flex justify-between border-b py-1.5">
                                    <span>{f?.name ?? "?"} × {h.quantity}</span>
                                    <span className="text-muted-foreground text-xs">{new Date(h.consumed_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}</span>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      </div>
                    </DialogContent>
                  )}
                </Dialog>
              );
            })}
          </div>
          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground py-12">Tidak ada siswa.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const StatCard = ({ icon, label, value, tone }: { icon: any; label: string; value: number; tone: "primary"|"success"|"warning"|"destructive" }) => {
  const tones: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    destructive: "bg-destructive/10 text-destructive",
  };
  return (
    <Card className="shadow-soft">
      <CardContent className="p-4">
        <div className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${tones[tone]}`}>{icon}</div>
        <p className="mt-3 text-2xl font-bold">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
};

export default Dashboard;
