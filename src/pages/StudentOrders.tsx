import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StudentBarcode } from "@/components/StudentBarcode";
import { formatNum } from "@/lib/nutrition";
import { toast } from "sonner";

const statusMap: Record<string, { label: string; cls: string }> = {
  pending: { label: "Menunggu", cls: "bg-warning text-warning-foreground" },
  ready: { label: "Siap Diambil", cls: "bg-primary text-primary-foreground" },
  completed: { label: "Selesai", cls: "bg-success text-success-foreground" },
  cancelled: { label: "Dibatalkan", cls: "bg-muted text-muted-foreground" },
};

const StudentOrders = () => {
  const { user } = useAuth();
  const [student, setStudent] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);

  const load = async () => {
    if (!user) return;
    const { data: s } = await supabase.from("students").select("*").eq("user_id", user.id).maybeSingle();
    setStudent(s);
    if (s) {
      const { data } = await supabase.from("orders")
        .select("*, order_items(*, foods(name))")
        .eq("student_id", s.id)
        .order("created_at", { ascending: false });
      setOrders(data ?? []);
    }
  };

  useEffect(() => { load(); }, [user]);

  const cancel = async (id: string) => {
    if (!confirm("Batalkan pesanan?")) return;
    const { error } = await supabase.from("orders").update({ status: "cancelled" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Pesanan dibatalkan"); load();
  };

  if (!student) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Pesananku</h1>
        <p className="text-muted-foreground">Tunjukkan QR code di bawah saat mengambil pesanan</p>
      </div>

      <Card className="shadow-soft">
        <CardHeader><CardTitle className="text-base">QR untuk Ambil Pesanan</CardTitle></CardHeader>
        <CardContent className="flex flex-col sm:flex-row items-center gap-4">
          <div className="bg-white p-3 rounded-md"><StudentBarcode value={student.nis} /></div>
          <div>
            <p className="font-semibold">{student.full_name}</p>
            <p className="text-sm text-muted-foreground">{student.class_name} • NIS {student.nis}</p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {orders.length === 0 && <p className="text-center text-muted-foreground py-8">Belum ada pesanan.</p>}
        {orders.map((o: any) => {
          const st = statusMap[o.status] ?? { label: o.status, cls: "" };
          return (
            <Card key={o.id} className="shadow-soft">
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString("id-ID")}</p>
                    <ul className="text-sm mt-1">
                      {o.order_items?.map((it: any) => (
                        <li key={it.id}>• {it.foods?.name} × {it.quantity}</li>
                      ))}
                    </ul>
                  </div>
                  <Badge className={st.cls}>{st.label}</Badge>
                </div>
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="text-xs text-muted-foreground">{formatNum(o.total_calories, 0)} kkal</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Rp {formatNum(o.total_price, 0)}</span>
                    {o.status === "pending" && (
                      <Button size="sm" variant="outline" onClick={() => cancel(o.id)}>Batalkan</Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default StudentOrders;
