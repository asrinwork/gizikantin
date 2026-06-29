import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { calcDailyTarget, getMbgCaloriesToday, getSchoolShare } from "@/lib/calorie";
import { recommend } from "@/lib/recommend";
import { formatNum, computeStatus, statusColor, statusLabel } from "@/lib/nutrition";
import { StudentBarcode } from "@/components/StudentBarcode";
import { Utensils, QrCode, TrendingUp, Sparkles } from "lucide-react";

const StudentDashboard = () => {
  const { user } = useAuth();
  const [student, setStudent] = useState<any>(null);
  const [foods, setFoods] = useState<any[]>([]);
  const [consumed, setConsumed] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0, sugar: 0 });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: s } = await supabase.from("students").select("*").eq("user_id", user.id).maybeSingle();
      setStudent(s);
      const { data: f } = await supabase.from("foods").select("*").order("name");
      setFoods((f ?? []));
      if (s) {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const { data: tx } = await supabase
          .from("transactions")
          .select("quantity, foods(calories,protein,carbs,fat,sugar)")
          .eq("student_id", s.id)
          .gte("consumed_at", today.toISOString());
        const c = (tx ?? []).reduce((acc: any, t: any) => {
          const f = t.foods; if (!f) return acc;
          const q = +t.quantity;
          return {
            calories: acc.calories + +f.calories * q,
            protein: acc.protein + +f.protein * q,
            carbs: acc.carbs + +f.carbs * q,
            fat: acc.fat + +f.fat * q,
            sugar: acc.sugar + +f.sugar * q,
          };
        }, { calories: 0, protein: 0, carbs: 0, fat: 0, sugar: 0 });
        setConsumed(c);
      }
    })();
  }, [user]);

  const target = useMemo(() => student ? calcDailyTarget(student) : { calories: 2000, protein: 50, carbs: 275, fat: 65, sugar: 50 }, [student]);
  const recs = useMemo(() => recommend(foods, target, consumed, 4), [foods, target, consumed]);

  if (!student) {
    return (
      <Card className="shadow-soft">
        <CardContent className="p-8 text-center text-muted-foreground">
          Akun siswa belum ditautkan. Hubungi admin sekolah.
        </CardContent>
      </Card>
    );
  }

  const calPct = Math.min(100, (consumed.calories / target.calories) * 100);
  const status = computeStatus(consumed.calories, target.calories);
  const remaining = Math.max(0, target.calories - consumed.calories);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Halo, {student.full_name.split(" ")[0]} 👋</h1>
        <p className="text-muted-foreground">Pantau asupan gizimu hari ini</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        {/* Calorie progress */}
        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" /> Kalori Hari Ini</CardTitle>
            <Badge className={statusColor(status)}>{statusLabel(status)}</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center py-4">
              <p className="text-5xl font-bold text-primary">{formatNum(consumed.calories, 0)}</p>
              <p className="text-sm text-muted-foreground mt-1">dari target {formatNum(target.calories, 0)} kkal</p>
              <p className="text-xs mt-2">Sisa: <span className="font-semibold">{formatNum(remaining, 0)} kkal</span></p>
            </div>
            <Progress value={calPct} className="h-3" />
            <div className="grid grid-cols-4 gap-2 text-xs text-center">
              {(["protein", "carbs", "fat", "sugar"] as const).map((k) => (
                <div key={k} className="rounded-md bg-muted/40 p-2">
                  <p className="font-semibold capitalize">{k === "carbs" ? "Karbo" : k === "sugar" ? "Gula" : k}</p>
                  <p className="text-muted-foreground">{formatNum(consumed[k])} / {formatNum(target[k])}g</p>
                </div>
              ))}
            </div>
            <Button asChild className="w-full" size="lg">
              <Link to="/menu"><Utensils className="h-4 w-4 mr-2" /> Pesan Makanan</Link>
            </Button>
          </CardContent>
        </Card>

        {/* QR Card */}
        <Card className="shadow-soft">
          <CardHeader><CardTitle className="flex items-center gap-2"><QrCode className="h-5 w-5 text-primary" /> Kartu QR Saya</CardTitle></CardHeader>
          <CardContent className="text-center space-y-2">
            <div className="bg-white rounded-md p-3 inline-block">
              <StudentBarcode value={student.nis} />
            </div>
            <div>
              <p className="font-semibold">{student.full_name}</p>
              <p className="text-xs text-muted-foreground">{student.class_name} • NIS {student.nis}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recommendations */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Rekomendasi Untukmu</CardTitle>
          <p className="text-sm text-muted-foreground">Menu yang cocok dengan sisa kebutuhan kalorimu hari ini</p>
        </CardHeader>
        <CardContent>
          {recs.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              Kebutuhan kalorimu sudah tercukupi. Hindari menambah konsumsi hari ini. 🎉
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {recs.map((f: any) => (
                <div key={f.id} className="rounded-lg border p-3 hover:shadow-md transition">
                  <p className="font-medium text-sm line-clamp-2">{f.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{formatNum(f.calories, 0)} kkal</p>
                  <p className="text-sm text-primary font-semibold mt-1">Rp {formatNum(f.price ?? 0, 0)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentDashboard;
