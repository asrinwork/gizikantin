import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Loader2,
  Trash2,
  ScanLine,
  Search,
  Plus,
  Minus,
  X,
  UserCircle2,
  ShoppingCart,
  Utensils,
} from "lucide-react";
import { formatNum } from "@/lib/nutrition";
import { BarcodeScanner } from "@/components/BarcodeScanner";

interface Student {
  id: string;
  nis: string;
  full_name: string;
  class_name: string;
}
interface Food {
  id: string;
  name: string;
  calories: number;
  price: number;
}
interface CartItem {
  food: Food;
  qty: number;
}
interface TxRow {
  id: string;
  quantity: number;
  consumed_at: string;
  students: { full_name: string; class_name: string } | null;
  foods: { name: string; calories: number; price: number } | null;
}

const rupiah = (n: number) =>
  "Rp " + Number(n ?? 0).toLocaleString("id-ID", { maximumFractionDigits: 0 });

const Transactions = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [foods, setFoods] = useState<Food[]>([]);
  const [recent, setRecent] = useState<TxRow[]>([]);

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentQuery, setStudentQuery] = useState("");
  const [studentPickerOpen, setStudentPickerOpen] = useState(false);

  const [foodQuery, setFoodQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);

  const [busy, setBusy] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  const load = async () => {
    const [s, f, r] = await Promise.all([
      supabase
        .from("students")
        .select("id,nis,full_name,class_name")
        .order("class_name")
        .order("full_name"),
      supabase.from("foods").select("id,name,calories,price").order("name"),
      supabase
        .from("transactions")
        .select(
          "id,quantity,consumed_at,students(full_name,class_name),foods(name,calories,price)"
        )
        .order("consumed_at", { ascending: false })
        .limit(15),
    ]);
    setStudents((s.data ?? []) as any);
    setFoods((f.data ?? []) as any);
    setRecent((r.data ?? []) as any);
  };
  useEffect(() => {
    load();
  }, []);

  const filteredFoods = useMemo(() => {
    const q = foodQuery.trim().toLowerCase();
    if (!q) return foods;
    return foods.filter((f) => f.name.toLowerCase().includes(q));
  }, [foods, foodQuery]);

  const filteredStudents = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    if (!q) return students.slice(0, 30);
    return students
      .filter(
        (s) =>
          s.full_name.toLowerCase().includes(q) ||
          s.nis.toLowerCase().includes(q) ||
          s.class_name.toLowerCase().includes(q)
      )
      .slice(0, 50);
  }, [students, studentQuery]);

  const totals = useMemo(() => {
    let calories = 0;
    let price = 0;
    let items = 0;
    for (const c of cart) {
      calories += (c.food.calories || 0) * c.qty;
      price += (c.food.price || 0) * c.qty;
      items += c.qty;
    }
    return { calories, price, items };
  }, [cart]);

  const addToCart = (food: Food) => {
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.food.id === food.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [...prev, { food, qty: 1 }];
    });
  };

  const updateQty = (foodId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) =>
          c.food.id === foodId ? { ...c, qty: Math.max(0, c.qty + delta) } : c
        )
        .filter((c) => c.qty > 0)
    );
  };

  const removeFromCart = (foodId: string) =>
    setCart((prev) => prev.filter((c) => c.food.id !== foodId));

  const clearAll = () => {
    setCart([]);
    setSelectedStudent(null);
    setStudentQuery("");
    setFoodQuery("");
  };

  const handleScanned = (code: string) => {
    const trimmed = code.trim();
    const found = students.find((s) => s.nis === trimmed);
    if (!found) {
      toast.error(`Siswa dengan NIS "${trimmed}" tidak ditemukan`);
      return;
    }
    setSelectedStudent(found);
    toast.success(`Siswa: ${found.full_name} (${found.class_name})`);
  };

  const submit = async () => {
    if (!selectedStudent) return toast.error("Pilih siswa terlebih dahulu");
    if (cart.length === 0) return toast.error("Keranjang masih kosong");
    setBusy(true);
    const rows = cart.map((c) => ({
      student_id: selectedStudent.id,
      food_id: c.food.id,
      quantity: c.qty,
      recorded_by: user?.id,
    }));
    const { error } = await supabase.from("transactions").insert(rows);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Transaksi tersimpan • ${rupiah(totals.price)}`);
    clearAll();
    load();
  };

  const removeRecent = async (id: string) => {
    if (!confirm("Hapus transaksi ini?")) return;
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Dihapus");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Kasir Kantin</h1>
          <p className="text-sm text-muted-foreground">
            Pilih siswa, klik makanan, lalu simpan transaksi
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
        {/* LEFT: Food grid */}
        <Card className="shadow-soft">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Cari makanan..."
                  value={foodQuery}
                  onChange={(e) => setFoodQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Badge variant="secondary" className="shrink-0">
                <Utensils className="h-3 w-3 mr-1" />
                {filteredFoods.length}
              </Badge>
            </div>

            {filteredFoods.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Tidak ada makanan ditemukan.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                {filteredFoods.map((f) => {
                  const inCart = cart.find((c) => c.food.id === f.id);
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => addToCart(f)}
                      className="group relative text-left rounded-lg border bg-card hover:border-primary hover:shadow-md transition-all p-3 active:scale-[0.98]"
                    >
                      {inCart && (
                        <span className="absolute top-1.5 right-1.5 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold px-1.5">
                          {inCart.qty}
                        </span>
                      )}
                      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary mb-2">
                        <Utensils className="h-5 w-5" />
                      </div>
                      <p className="font-medium text-sm leading-tight line-clamp-2">
                        {f.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatNum(f.calories, 0)} kkal
                      </p>
                      <p className="text-sm font-semibold text-primary mt-1">
                        {rupiah(f.price)}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* RIGHT: Student + Cart */}
        <div className="space-y-4 lg:sticky lg:top-4 self-start">
          {/* Student selector */}
          <Card className="shadow-soft">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Siswa</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setScannerOpen(true)}
                >
                  <ScanLine className="h-4 w-4 mr-1.5" />
                  Scan QR
                </Button>
              </div>

              {selectedStudent ? (
                <div className="flex items-center gap-3 rounded-lg border bg-primary/5 p-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <UserCircle2 className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">
                      {selectedStudent.full_name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {selectedStudent.class_name} • NIS {selectedStudent.nis}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setSelectedStudent(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Cari nama / NIS / kelas..."
                      value={studentQuery}
                      onChange={(e) => {
                        setStudentQuery(e.target.value);
                        setStudentPickerOpen(true);
                      }}
                      onFocus={() => setStudentPickerOpen(true)}
                      className="pl-9"
                    />
                  </div>
                  {studentPickerOpen && (
                    <div className="rounded-md border max-h-60 overflow-hidden">
                      <ScrollArea className="max-h-60">
                        {filteredStudents.length === 0 ? (
                          <p className="py-6 text-center text-sm text-muted-foreground">
                            Tidak ada siswa.
                          </p>
                        ) : (
                          <ul className="divide-y">
                            {filteredStudents.map((s) => (
                              <li key={s.id}>
                                <button
                                  type="button"
                                  className="w-full text-left px-3 py-2 hover:bg-accent transition-colors"
                                  onClick={() => {
                                    setSelectedStudent(s);
                                    setStudentPickerOpen(false);
                                    setStudentQuery("");
                                  }}
                                >
                                  <p className="text-sm font-medium truncate">
                                    {s.full_name}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {s.class_name} • {s.nis}
                                  </p>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </ScrollArea>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cart */}
          <Card className="shadow-soft">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  Keranjang
                  <Badge variant="secondary">{totals.items}</Badge>
                </p>
                {cart.length > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setCart([])}
                    className="text-muted-foreground"
                  >
                    Kosongkan
                  </Button>
                )}
              </div>

              {cart.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Klik makanan di sebelah kiri untuk menambahkan.
                </div>
              ) : (
                <ScrollArea className="max-h-72">
                  <ul className="space-y-2 pr-2">
                    {cart.map((c) => (
                      <li
                        key={c.food.id}
                        className="flex items-center gap-2 rounded-md border p-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {c.food.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {rupiah(c.food.price)} × {c.qty} ={" "}
                            <span className="font-medium text-foreground">
                              {rupiah(c.food.price * c.qty)}
                            </span>
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-7 w-7"
                            onClick={() => updateQty(c.food.id, -1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-6 text-center text-sm font-semibold">
                            {c.qty}
                          </span>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-7 w-7"
                            onClick={() => updateQty(c.food.id, +1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => removeFromCart(c.food.id)}
                          >
                            <X className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              )}

              <div className="border-t pt-3 space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Total Kalori</span>
                  <span>{formatNum(totals.calories, 0)} kkal</span>
                </div>
                <div className="flex justify-between text-base font-bold">
                  <span>Total</span>
                  <span className="text-primary">{rupiah(totals.price)}</span>
                </div>
              </div>

              <Button
                onClick={submit}
                disabled={busy || cart.length === 0 || !selectedStudent}
                className="w-full h-11 text-base"
                size="lg"
              >
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Bayar & Simpan
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent transactions */}
      <Card className="shadow-soft">
        <CardContent className="p-4">
          <p className="text-sm font-medium mb-3">Transaksi Terbaru</p>
          {recent.length === 0 ? (
            <p className="text-muted-foreground text-sm">Belum ada transaksi.</p>
          ) : (
            <ul className="divide-y">
              {recent.map((t) => (
                <li
                  key={t.id}
                  className="py-2.5 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">
                      {t.students?.full_name}{" "}
                      <span className="text-muted-foreground">
                        • {t.students?.class_name}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {t.foods?.name} × {t.quantity} •{" "}
                      {formatNum((t.foods?.calories ?? 0) * t.quantity, 0)} kkal •{" "}
                      {rupiah((t.foods?.price ?? 0) * t.quantity)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(t.consumed_at).toLocaleString("id-ID", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeRecent(t.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <BarcodeScanner
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onDetected={handleScanned}
      />
    </div>
  );
};

export default Transactions;
