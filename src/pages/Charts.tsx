import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Line, LineChart } from "recharts";
import { formatNum } from "@/lib/nutrition";
import { calcDailyTarget } from "@/lib/calorie";
import { AlertTriangle, TrendingUp } from "lucide-react";

type Range = "day" | "week" | "month";

const Charts = () => {
  const [range, setRange] = useState<Range>("week");
  const [data, setData] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [foods, setFoods] = useState<any[]>([]);

  const load = async () => {
    const from = new Date();
    const days = range === "day" ? 1 : range === "week" ? 7 : 30;
    from.setDate(from.getDate() - days);
    from.setHours(0, 0, 0, 0);
    const [tx, st, fd] = await Promise.all([
      supabase.from("transactions").select("student_id,quantity,consumed_at,foods(calories,protein,carbs,fat,sugar)")
        .gte("consumed_at", from.toISOString()),
      supabase.from("students").select("*"),
      supabase.from("foods").select("id,name,calories"),
    ]);
    setData(tx.data ?? []);
    setStudents(st.data ?? []);
    setFoods(fd.data ?? []);
  };

  useEffect(() => { load(); }, [range]);

  // Aggregate per day
  const daily = useMemo(() => {
    const map: Record<string, number> = {};
    data.forEach((t: any) => {
      const k = new Date(t.consumed_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
      map[k] = (map[k] ?? 0) + +t.quantity * (+t.foods?.calories || 0);
    });
    return Object.entries(map).map(([date, calories]) => ({ date, calories: Math.round(calories) }));
  }, [data]);

  // Status per student
  const studentStats = useMemo(() => {
    const consumedByStudent: Record<string, number> = {};
    data.forEach((t: any) => {
      consumedByStudent[t.student_id] = (consumedByStudent[t.student_id] ?? 0) + +t.quantity * (+t.foods?.calories || 0);
    });
    const days = range === "day" ? 1 : range === "week" ? 7 : 30;
    return students.map((s) => {
      const target = calcDailyTarget(s).calories * days;
      const consumed = consumedByStudent[s.id] ?? 0;
      const pct = (consumed / target) * 100;
      let status: "kurang" | "ideal" | "berlebih" = "ideal";
      if (pct < 80) status = "kurang";
      else if (pct > 110) status = "berlebih";
      return { student: s, consumed, target, pct, status };
    });
  }, [data, students, range]);

  const alerts = studentStats.filter((s) => s.status !== "ideal");
  const dist = {
    kurang: studentStats.filter((s) => s.status === "kurang").length,
    ideal: studentStats.filter((s) => s.status === "ideal").length,
    berlebih: studentStats.filter((s) => s.status === "berlebih").length,
  };

  // Top foods
  const topFoods = useMemo(() => {
    const map: Record<string, number> = {};
    data.forEach((t: any) => {
      map[t.student_id] = 0; // placeholder
    });
    const cnt: Record<string, number> = {};
    data.forEach((t: any) => {
      const name = foods.find((f: any) => f.id === (t as any).food_id)?.name ?? "?";
      cnt[name] = (cnt[name] ?? 0) + +t.quantity;
    });
    return Object.entries(cnt).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty).slice(0, 8);
  }, [data, foods]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Grafik & Monitoring</h1>
        <p className="text-muted-foreground">Tren konsumsi & status gizi siswa</p>
      </div>

      <Tabs value={range} onValueChange={(v) => setRange(v as Range)}>
        <TabsList>
          <TabsTrigger value="day">Hari ini</TabsTrigger>
          <TabsTrigger value="week">7 Hari</TabsTrigger>
          <TabsTrigger value="month">30 Hari</TabsTrigger>
        </TabsList>
        <TabsContent value={range}>
          <div className="grid gap-4 md:grid-cols-3 mt-4">
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Kurang Asupan</p><p className="text-3xl font-bold text-warning">{dist.kurang}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Ideal</p><p className="text-3xl font-bold text-success">{dist.ideal}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Berlebih</p><p className="text-3xl font-bold text-destructive">{dist.berlebih}</p></CardContent></Card>
          </div>
        </TabsContent>
      </Tabs>

      <Card className="shadow-soft">
        <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" /> Total Kalori Per Hari</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip />
              <Line type="monotone" dataKey="calories" stroke="hsl(var(--primary))" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader><CardTitle>Top Menu Dikonsumsi</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={topFoods}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip />
              <Bar dataKey="qty" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {alerts.length > 0 && (
        <Card className="shadow-soft border-warning/40">
          <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-warning" /> Siswa Perlu Perhatian ({alerts.length})</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y">
              {alerts.slice(0, 20).map((a) => (
                <li key={a.student.id} className="py-2 flex justify-between items-center">
                  <div>
                    <p className="font-medium text-sm">{a.student.full_name}</p>
                    <p className="text-xs text-muted-foreground">{a.student.class_name} • {formatNum(a.consumed, 0)} / {formatNum(a.target, 0)} kkal</p>
                  </div>
                  <Badge variant={a.status === "berlebih" ? "destructive" : "secondary"}>{a.status}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Charts;
