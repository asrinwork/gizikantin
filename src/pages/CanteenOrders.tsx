import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { formatNum } from "@/lib/nutrition";
import { ScanLine, CheckCircle2, Clock, XCircle, Package } from "lucide-react";
import { toast } from "sonner";

const CanteenOrders = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [scannerOpen, setScannerOpen] = useState(false);

  const load = async () => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from("orders")
      .select("*, students(nis, full_name, class_name), order_items(*, foods(name))")
      .gte("created_at", today.toISOString())
      .order("created_at", { ascending: false });
    setOrders(data ?? []);
  };

  useEffect(() => { load(); }, []);

  const setStatus = async (id: string, status: string, withVerify = false) => {
    const payload: any = { status };
    if (withVerify) { payload.verified_by = user?.id; payload.verified_at = new Date().toISOString(); }
    const { error } = await supabase.from("orders").update(payload).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Status diperbarui"); load();
  };

  const handleScan = async (code: string) => {
    const nis = code.trim();
    const { data: s } = await supabase.from("students").select("id, full_name").eq("nis", nis).maybeSingle();
    if (!s) return toast.error(`Siswa NIS ${nis} tidak ditemukan`);
    const readyOrders = orders.filter((o) => o.student_id === s.id && o.status === "ready");
    if (readyOrders.length === 0) return toast.error(`Tidak ada pesanan SIAP untuk ${s.full_name}`);
    for (const o of readyOrders) {
      await supabase.from("orders").update({
        status: "completed", verified_by: user?.id, verified_at: new Date().toISOString(),
      }).eq("id", o.id);
    }
    toast.success(`${readyOrders.length} pesanan ${s.full_name} diselesaikan`);
    load();
  };

  const pending = orders.filter((o) => o.status === "pending");
  const ready = orders.filter((o) => o.status === "ready");
  const completed = orders.filter((o) => o.status === "completed");

  const renderOrder = (o: any) => (
    <div key={o.id} className="rounded-lg border p-3 space-y-2 hover:shadow-md transition">
      <div className="flex justify-between items-start gap-2">
        <div>
          <p className="font-semibold">{o.students?.full_name}</p>
          <p className="text-xs text-muted-foreground">{o.students?.class_name} • NIS {o.students?.nis}</p>
          <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleTimeString("id-ID")}</p>
        </div>
        <div className="text-right">
          <p className="font-bold text-primary">Rp {formatNum(o.total_price, 0)}</p>
          <p className="text-xs text-muted-foreground">{formatNum(o.total_calories, 0)} kkal</p>
        </div>
      </div>
      <ul className="text-sm space-y-0.5 border-t pt-2">
        {o.order_items?.map((it: any) => <li key={it.id}>• {it.foods?.name} × {it.quantity}</li>)}
      </ul>
      <div className="flex gap-2 pt-1">
        {o.status === "pending" && (
          <>
            <Button size="sm" onClick={() => setStatus(o.id, "ready")}><Package className="h-3 w-3 mr-1" /> Tandai Siap</Button>
            <Button size="sm" variant="outline" onClick={() => setStatus(o.id, "cancelled")}>Batal</Button>
          </>
        )}
        {o.status === "ready" && (
          <Button size="sm" onClick={() => setStatus(o.id, "completed", true)}><CheckCircle2 className="h-3 w-3 mr-1" /> Selesai (Diambil)</Button>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-end flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Pesanan Masuk</h1>
          <p className="text-sm text-muted-foreground">Kelola antrian pesanan siswa hari ini</p>
        </div>
        <Button onClick={() => setScannerOpen(true)}><ScanLine className="h-4 w-4 mr-2" /> Scan QR Siswa</Button>
      </div>

      <Tabs defaultValue="pending">
        <TabsList className="grid grid-cols-3">
          <TabsTrigger value="pending"><Clock className="h-4 w-4 mr-1.5" /> Menunggu ({pending.length})</TabsTrigger>
          <TabsTrigger value="ready"><Package className="h-4 w-4 mr-1.5" /> Siap ({ready.length})</TabsTrigger>
          <TabsTrigger value="completed"><CheckCircle2 className="h-4 w-4 mr-1.5" /> Selesai ({completed.length})</TabsTrigger>
        </TabsList>
        {[["pending", pending], ["ready", ready], ["completed", completed]].map(([k, arr]: any) => (
          <TabsContent key={k} value={k}>
            <Card className="shadow-soft">
              <CardContent className="p-4">
                {arr.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">Tidak ada pesanan.</p>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">{arr.map(renderOrder)}</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <BarcodeScanner open={scannerOpen} onOpenChange={setScannerOpen} onDetected={handleScan} />
    </div>
  );
};

export default CanteenOrders;
