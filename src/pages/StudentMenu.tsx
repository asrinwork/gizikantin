import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { calcDailyTarget } from "@/lib/calorie";
import { recommend } from "@/lib/recommend";
import { formatNum, computeBMI, bmiCategory, bmiBadgeClass } from "@/lib/nutrition";
import { Search, Plus, Minus, X, Sparkles, AlertTriangle, ShoppingCart, Loader2 } from "lucide-react";
import { toast } from "sonner";

const rupiah = (n: number) => "Rp " + Number(n ?? 0).toLocaleString("id-ID");

const StudentMenu = () => {
  const { user } = useAuth();
  const nav = useNavigate();
  const [student, setStudent] = useState<any>(null);
  const [foods, setFoods] = useState<any[]>([]);
  const [consumedToday, setConsumedToday] = useState(0);
  const [pendingCal, setPendingCal] = useState(0);
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data: s } = await supabase.from("students").select("*").eq("user_id", user.id).maybeSingle();
    setStudent(s);
    const { data: f } = await supabase.from("foods").select("*").order("name");
    setFoods(f ?? []);
    if (s) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const { data: tx } = await supabase.from("transactions")
        .select("quantity, foods(calories)")
        .eq("student_id", s.id).gte("consumed_at", today.toISOString());
      setConsumedToday((tx ?? []).reduce((a: number, t: any) => a + +t.quantity * (+t.foods?.calories || 0), 0));
      const { data: po } = await supabase.from("orders")
        .select("total_calories")
        .eq("student_id", s.id).in("status", ["pending", "ready"])
        .gte("created_at", today.toISOString());
      setPendingCal((po ?? []).reduce((a: number, o: any) => a + +o.total_calories, 0));
    }
  };

  useEffect(() => { load(); }, [user]);

  const target = useMemo(() => student ? calcDailyTarget(student) : { calories: 2000, protein: 50, carbs: 275, fat: 65, sugar: 50 }, [student]);
  const totals = useMemo(() => {
    let cal = 0, price = 0, items = 0;
    for (const [id, qty] of Object.entries(cart)) {
      const f = foods.find((x: any) => x.id === id); if (!f) continue;
      cal += +f.calories * qty; price += +f.price * qty; items += qty;
    }
    return { cal, price, items };
  }, [cart, foods]);

  const consumed = consumedToday + pendingCal;
  const remaining = Math.max(0, target.calories - consumed);
  const wouldExceed = consumed + totals.cal > target.calories;

  const recs = useMemo(() => recommend(foods, target, { calories: consumed, protein: 0, carbs: 0, fat: 0, sugar: 0 }), [foods, target, consumed]);

  const filteredFoods = foods.filter((f: any) => f.name.toLowerCase().includes(query.toLowerCase()));

  const add = (id: string) => setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
  const inc = (id: string, d: number) => setCart((c) => {
    const next = (c[id] ?? 0) + d;
    const copy = { ...c };
    if (next <= 0) delete copy[id]; else copy[id] = next;
    return copy;
  });

  const checkout = async () => {
    if (!student) return;
    if (totals.items === 0) return toast.error("Keranjang kosong");
    if (wouldExceed) return toast.error("Pesanan melebihi kebutuhan kalori harian");
    setBusy(true);
    const { data: order, error } = await supabase.from("orders").insert({
      student_id: student.id, total_calories: totals.cal, total_price: totals.price, status: "pending",
    }).select("id").single();
    if (error || !order) { setBusy(false); return toast.error(error?.message ?? "Gagal"); }

    const items = Object.entries(cart).map(([id, qty]) => {
      const f = foods.find((x: any) => x.id === id);
      return { order_id: order.id, food_id: id, quantity: qty, unit_calories: +f.calories, unit_price: +f.price };
    });
    const { error: ie } = await supabase.from("order_items").insert(items);
    setBusy(false);
    if (ie) {
      await supabase.from("orders").delete().eq("id", order.id);
      return toast.error(ie.message);
    }
    toast.success("Pesanan dibuat! Tunjukkan QR di kantin saat mengambil.");
    setCart({});
    nav("/orders");
  };

  if (!student) return <Card><CardContent className="p-8 text-center text-muted-foreground">Profil siswa tidak ditemukan.</CardContent></Card>;

  const bmi = computeBMI(student?.weight_kg, student?.height_cm);
  const bmiCat = bmiCategory(bmi);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Pesan Makanan</h1>
          <p className="text-sm text-muted-foreground">Sisa kebutuhan kalori hari ini: <strong>{formatNum(remaining, 0)} kkal</strong></p>
        </div>
        {bmiCat && (
          <div className="text-right">
            <Badge className={bmiBadgeClass(bmiCat)}>Status: {bmiCat}</Badge>
            <p className="text-[10px] text-muted-foreground mt-0.5">IMT {formatNum(bmi!, 1)} kg/m²</p>
          </div>
        )}
      </div>

      <Card className="shadow-soft">
        <CardContent className="p-4 space-y-2">
          <div className="flex justify-between text-xs">
            <span>Sudah dikonsumsi + dipesan</span>
            <span>{formatNum(consumed, 0)} / {formatNum(target.calories, 0)} kkal</span>
          </div>
          <Progress value={Math.min(100, (consumed / target.calories) * 100)} className="h-2" />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {recs.length > 0 && (
            <Card className="shadow-soft border-primary/30">
              <CardContent className="p-4">
                <p className="text-sm font-medium flex items-center gap-1.5 mb-3"><Sparkles className="h-4 w-4 text-primary" /> Direkomendasikan untukmu</p>
                <div className="flex gap-2 flex-wrap">
                  {recs.map((f: any) => (
                    <Button key={f.id} variant="outline" size="sm" onClick={() => add(f.id)} className="text-xs">
                      <Plus className="h-3 w-3 mr-1" /> {f.name} ({formatNum(f.calories, 0)} kkal)
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="shadow-soft">
            <CardContent className="p-4 space-y-3">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" placeholder="Cari menu..." value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {filteredFoods.map((f: any) => {
                  const inCart = cart[f.id];
                  const overshoot = consumed + totals.cal + +f.calories > target.calories;
                  return (
                    <button key={f.id} type="button" onClick={() => !overshoot && add(f.id)} disabled={overshoot && !inCart}
                      className={`relative text-left rounded-lg border p-3 transition ${overshoot && !inCart ? "opacity-50 cursor-not-allowed" : "hover:border-primary hover:shadow-md"}`}>
                      {inCart && <span className="absolute top-1.5 right-1.5 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs px-1.5">{inCart}</span>}
                      <p className="font-medium text-sm line-clamp-2">{f.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{formatNum(f.calories, 0)} kkal</p>
                      <p className="text-sm font-semibold text-primary mt-1">{rupiah(f.price)}</p>
                      {overshoot && !inCart && <Badge variant="destructive" className="mt-2 text-[10px]">Melebihi kalori</Badge>}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-soft lg:sticky lg:top-4 self-start">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium flex items-center gap-2"><ShoppingCart className="h-4 w-4" /> Keranjang <Badge variant="secondary">{totals.items}</Badge></p>
            {totals.items === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Pilih menu di samping.</p>
            ) : (
              <ul className="space-y-2 max-h-80 overflow-auto">
                {Object.entries(cart).map(([id, qty]) => {
                  const f = foods.find((x: any) => x.id === id); if (!f) return null;
                  return (
                    <li key={id} className="flex items-center gap-2 rounded-md border p-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{f.name}</p>
                        <p className="text-xs text-muted-foreground">{formatNum(f.calories * qty, 0)} kkal • {rupiah(f.price * qty)}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => inc(id, -1)}><Minus className="h-3 w-3" /></Button>
                        <span className="w-6 text-center text-sm font-semibold">{qty}</span>
                        <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => inc(id, 1)}><Plus className="h-3 w-3" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => inc(id, -qty)}><X className="h-3 w-3 text-destructive" /></Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="border-t pt-3 space-y-1.5">
              <div className="flex justify-between text-xs"><span>Total Kalori</span><span className={wouldExceed ? "text-destructive font-semibold" : ""}>{formatNum(totals.cal, 0)} kkal</span></div>
              <div className="flex justify-between font-bold"><span>Total</span><span className="text-primary">{rupiah(totals.price)}</span></div>
            </div>

            {wouldExceed && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-2 text-xs flex gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                <span>Pesanan akan melebihi kebutuhan kalori harianmu. Kurangi item.</span>
              </div>
            )}

            <Button onClick={checkout} disabled={busy || totals.items === 0 || wouldExceed} className="w-full" size="lg">
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Pesan Sekarang
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StudentMenu;
