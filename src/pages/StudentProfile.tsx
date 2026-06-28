import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ACTIVITY_LABEL, calcDailyTarget, type ActivityLevel } from "@/lib/calorie";
import { formatNum, computeBMI, bmiCategory, bmiBadgeClass } from "@/lib/nutrition";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const StudentProfile = () => {
  const { user } = useAuth();
  const [s, setS] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("students").select("*").eq("user_id", user.id).maybeSingle().then(({ data }) => setS(data));
  }, [user]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!s) return;
    setBusy(true);
    const { error } = await supabase.from("students").update({
      height_cm: s.height_cm ? +s.height_cm : null,
      weight_kg: s.weight_kg ? +s.weight_kg : null,
      activity_level: s.activity_level,
    }).eq("id", s.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Profil diperbarui");
  };

  if (!s) return null;
  const target = calcDailyTarget(s);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold">Profil Saya</h1>
        <p className="text-muted-foreground">Data ini dipakai untuk menghitung kebutuhan kalori harian</p>
      </div>

      <Card className="shadow-soft">
        <CardHeader><CardTitle>Identitas</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><span className="text-muted-foreground">Nama:</span> <strong>{s.full_name}</strong></p>
          <p><span className="text-muted-foreground">NIS:</span> {s.nis}</p>
          <p><span className="text-muted-foreground">Kelas:</span> {s.class_name}</p>
          <p><span className="text-muted-foreground">Tanggal lahir:</span> {s.birth_date ?? "-"}</p>
          <p><span className="text-muted-foreground">Jenis kelamin:</span> {s.gender === "P" ? "Perempuan" : "Laki-laki"}</p>
        </CardContent>
      </Card>

      {(() => {
        const bmi = computeBMI(s.weight_kg ? +s.weight_kg : null, s.height_cm ? +s.height_cm : null);
        const cat = bmiCategory(bmi);
        if (!cat) return null;
        return (
          <Card className="shadow-soft">
            <CardHeader><CardTitle>Status Berat Badan (IMT)</CardTitle></CardHeader>
            <CardContent className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">IMT</p>
                <p className="text-2xl font-bold">{formatNum(bmi!, 1)} <span className="text-sm font-normal text-muted-foreground">kg/m²</span></p>
              </div>
              <Badge className={bmiBadgeClass(cat) + " text-base px-3 py-1"}>{cat}</Badge>
            </CardContent>
          </Card>
        );
      })()}


      <Card className="shadow-soft">
        <CardHeader><CardTitle>Data Tubuh & Aktivitas</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={save} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Tinggi (cm)</Label><Input type="number" step="0.1" value={s.height_cm ?? ""} onChange={(e) => setS({ ...s, height_cm: e.target.value })} /></div>
              <div><Label>Berat (kg)</Label><Input type="number" step="0.1" value={s.weight_kg ?? ""} onChange={(e) => setS({ ...s, weight_kg: e.target.value })} /></div>
            </div>
            <div>
              <Label>Level Aktivitas</Label>
              <Select value={s.activity_level ?? "light"} onValueChange={(v) => setS({ ...s, activity_level: v as ActivityLevel })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ACTIVITY_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Simpan</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="shadow-soft bg-primary/5">
        <CardHeader><CardTitle>Kebutuhan Gizi Harian</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
          {[
            ["Kalori", `${formatNum(target.calories, 0)} kkal`],
            ["Protein", `${target.protein} g`],
            ["Karbo", `${target.carbs} g`],
            ["Lemak", `${target.fat} g`],
            ["Gula max", `${target.sugar} g`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-md bg-card p-3">
              <p className="text-xs text-muted-foreground">{k}</p>
              <p className="font-bold text-primary">{v}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentProfile;
