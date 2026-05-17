import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface Row { user_id: string; role: string; }
interface Profile { id: string; full_name: string; email: string | null; }

const Users = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});

  const load = async () => {
    const [{ data: r }, { data: p }] = await Promise.all([
      supabase.from("user_roles").select("user_id,role").order("role"),
      supabase.from("profiles").select("id,full_name,email"),
    ]);
    setRows((r ?? []) as any);
    const map: Record<string, Profile> = {};
    (p ?? []).forEach((x: any) => { map[x.id] = x; });
    setProfiles(map);
  };
  useEffect(() => { load(); }, []);

  const addRole = async (user_id: string, role: string) => {
    const { error } = await supabase.from("user_roles").insert({ user_id, role: role as any });
    if (error) return toast.error(error.message);
    toast.success("Peran ditambahkan"); load();
  };

  const removeRole = async (user_id: string, role: string) => {
    const { error } = await supabase.from("user_roles").delete().eq("user_id", user_id).eq("role", role as any);
    if (error) return toast.error(error.message);
    toast.success("Peran dihapus"); load();
  };

  // Group by user
  const grouped = rows.reduce<Record<string, string[]>>((acc, r) => {
    (acc[r.user_id] ??= []).push(r.role);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Kelola User</h1>
        <p className="text-muted-foreground">Atur peran pengguna sistem</p>
      </div>

      <Card className="shadow-soft">
        <CardHeader><CardTitle>Pengguna & Peran ({Object.keys(grouped).length})</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Object.entries(grouped).map(([uid, roles]) => {
              const p = profiles[uid];
              return (
                <div key={uid} className="flex flex-wrap items-center gap-2 justify-between rounded-md border p-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{p?.full_name || "(tanpa nama)"}</p>
                    <p className="text-xs text-muted-foreground truncate">{p?.email || uid}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {roles.map((r) => (
                        <Badge key={r} variant="secondary" className="capitalize">
                          {r}
                          <button onClick={() => removeRole(uid, r)} className="ml-1.5 text-destructive hover:underline">×</button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Select onValueChange={(v) => addRole(uid, v)}>
                    <SelectTrigger className="w-40"><SelectValue placeholder="+ Tambah peran" /></SelectTrigger>
                    <SelectContent>
                      {["admin", "guru", "kantin", "siswa"].filter((r) => !roles.includes(r)).map((r) => (
                        <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
            {Object.keys(grouped).length === 0 && <p className="text-center py-8 text-muted-foreground">Belum ada user.</p>}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            User baru dibuat melalui halaman Daftar (untuk staf) atau Import CSV Siswa (untuk siswa).
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Users;
