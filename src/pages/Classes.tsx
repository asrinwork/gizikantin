import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";
import { DataTable } from "@/components/DataTable";

interface ClassRow { id: string; name: string; grade_level: number | null; homeroom_teacher_id: string | null; }
interface Teacher { id: string; full_name: string; email: string | null; }

const Classes = () => {
  const [list, setList] = useState<ClassRow[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ClassRow | null>(null);
  const [form, setForm] = useState({ name: "", grade_level: "", homeroom_teacher_id: "none" });

  const load = async () => {
    const { data } = await supabase.from("classes").select("*").order("name");
    setList((data ?? []) as any);
    const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "wali_kelas");
    const ids = (roles ?? []).map((r: any) => r.user_id);
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,full_name,email").in("id", ids);
      setTeachers((profs ?? []) as any);
    } else setTeachers([]);
  };
  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {
      name: form.name,
      grade_level: form.grade_level ? +form.grade_level : null,
      homeroom_teacher_id: form.homeroom_teacher_id === "none" ? null : form.homeroom_teacher_id,
    };
    if (editing) {
      const { error } = await supabase.from("classes").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      await logAudit("update_class", "class", editing.id, payload);
    } else {
      const { data, error } = await supabase.from("classes").insert(payload).select("id").single();
      if (error) return toast.error(error.message);
      await logAudit("create_class", "class", data?.id ?? null, payload);
    }
    if (payload.homeroom_teacher_id) await logAudit("assign_homeroom", "class", editing?.id ?? null, { teacher: payload.homeroom_teacher_id });
    toast.success("Tersimpan"); setOpen(false); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Hapus kelas ini?")) return;
    const { error } = await supabase.from("classes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await logAudit("delete_class", "class", id, {});
    toast.success("Dihapus"); load();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Kelola Kelas</h1>
          <p className="text-muted-foreground">Daftar kelas & penugasan wali kelas</p>
        </div>
        <Button onClick={() => { setEditing(null); setForm({ name: "", grade_level: "", homeroom_teacher_id: "none" }); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Tambah Kelas
        </Button>
      </div>

      <Card className="shadow-soft">
        <CardHeader><CardTitle>Daftar Kelas ({list.length})</CardTitle></CardHeader>
        <CardContent>
          <DataTable
            data={list}
            rowKey={(c) => c.id}
            searchPlaceholder="Cari kelas atau wali..."
            emptyMessage="Belum ada kelas."
            columns={[
              { key: "name", header: "Nama", accessor: (c) => c.name, cell: (c) => <span className="font-medium">{c.name}</span> },
              { key: "grade", header: "Tingkat", accessor: (c) => c.grade_level ?? 0, cell: (c) => c.grade_level ?? "-" },
              {
                key: "wali", header: "Wali Kelas",
                accessor: (c) => teachers.find((x) => x.id === c.homeroom_teacher_id)?.full_name ?? "",
                cell: (c) => {
                  const t = teachers.find((x) => x.id === c.homeroom_teacher_id);
                  return t ? <Badge variant="secondary">{t.full_name}</Badge> : <span className="text-muted-foreground">—</span>;
                },
              },
              {
                key: "act", header: "", sortable: false, align: "right",
                cell: (c) => (
                  <div className="whitespace-nowrap">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(c); setForm({ name: c.name, grade_level: c.grade_level?.toString() ?? "", homeroom_teacher_id: c.homeroom_teacher_id ?? "none" }); setOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(c.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit" : "Tambah"} Kelas</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div><Label>Nama</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="contoh: 7A" /></div>
            <div><Label>Tingkat</Label><Input type="number" value={form.grade_level} onChange={(e) => setForm({ ...form, grade_level: e.target.value })} placeholder="7" /></div>
            <div>
              <Label>Wali Kelas</Label>
              <Select value={form.homeroom_teacher_id} onValueChange={(v) => setForm({ ...form, homeroom_teacher_id: v })}>
                <SelectTrigger><SelectValue placeholder="Pilih wali kelas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Tidak ditugaskan —</SelectItem>
                  {teachers.map((t) => <SelectItem key={t.id} value={t.id}>{t.full_name} ({t.email})</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">Hanya user dengan peran <b>wali_kelas</b> yang muncul.</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
              <Button type="submit">Simpan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Classes;
