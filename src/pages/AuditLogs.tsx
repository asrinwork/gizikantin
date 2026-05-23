import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/DataTable";

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
          <DataTable
            data={logs}
            rowKey={(l) => l.id}
            searchPlaceholder="Cari aksi, aktor, atau entitas..."
            emptyMessage="Belum ada aktivitas."
            initialSort={{ key: "waktu", dir: "desc" }}
            columns={[
              { key: "waktu", header: "Waktu", accessor: (l) => l.created_at, cell: (l) => <span className="whitespace-nowrap">{new Date(l.created_at).toLocaleString("id-ID")}</span> },
              { key: "aktor", header: "Aktor", accessor: (l) => l.actor_email ?? "", cell: (l) => l.actor_email ?? "-" },
              { key: "aksi", header: "Aksi", accessor: (l) => l.action, cell: (l) => <Badge variant="secondary">{l.action}</Badge> },
              { key: "entitas", header: "Entitas", accessor: (l) => l.entity, cell: (l) => <>{l.entity}{l.entity_id ? <span className="text-muted-foreground"> · {l.entity_id.slice(0, 8)}</span> : ""}</> },
              { key: "detail", header: "Detail", sortable: false, cell: (l) => <code className="text-xs break-all max-w-md inline-block">{l.detail ? JSON.stringify(l.detail) : ""}</code> },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default AuditLogs;
