import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Log { id: string; actor_email: string | null; action: string; entity: string; entity_id: string | null; detail: any; created_at: string; }

const AuditLogs = () => {
  const [logs, setLogs] = useState<Log[]>([]);
  useEffect(() => {
    supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(500)
      .then(({ data }) => setLogs((data ?? []) as any));
  }, []);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Audit Log</h1>
        <p className="text-muted-foreground">Riwayat aktivitas admin (500 terbaru)</p>
      </div>
      <Card className="shadow-soft">
        <CardHeader><CardTitle>{logs.length} aktivitas</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2">Waktu</th><th>Aktor</th><th>Aksi</th><th>Entitas</th><th>Detail</th></tr></thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b align-top">
                    <td className="py-2 whitespace-nowrap">{new Date(l.created_at).toLocaleString("id-ID")}</td>
                    <td>{l.actor_email ?? "-"}</td>
                    <td><Badge variant="secondary">{l.action}</Badge></td>
                    <td>{l.entity}{l.entity_id ? ` · ${l.entity_id.slice(0, 8)}` : ""}</td>
                    <td className="text-xs max-w-md"><code className="break-all">{l.detail ? JSON.stringify(l.detail) : ""}</code></td>
                  </tr>
                ))}
                {logs.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Belum ada aktivitas.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuditLogs;
