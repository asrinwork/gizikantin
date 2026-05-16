import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface ClassRow { id: string; name: string; grade_level: number | null; }

const Classes = () => {
  const [list, setList] = useState<ClassRow[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ClassRow | null>(null);
  const [form, setForm] = useState({ name: "", grade_level: "" });

  const load = async () => {
    const { data } = await supabase.from("classes").select("*").order("name");
    setList((data ?? []) as any);
  };
  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { name: form.name, grade_level: form.grade_level ? +form.grade_level : null };
    const q = editing ? supabase.from("classes").update(payload).eq("id", editing.id) : supabase.from("classes").insert(payload);
    const { error } = await q;
    if (error) return toast.error(error.message);
    toast.success("Tersimpan"); setOpen(false); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Hapus kelas ini?")) return;
    const { error } = await supabase.from("classes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Dihapus"); load();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Kelola Kelas</h1>
          <p className="text-muted-foreground">Daftar kelas di sekolah</p>
        </div>
        <Button onClick={() => { setEditing(null); setForm({ name: "", grade_level: "" }); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Tambah Kelas
        </Button>
      </div>

      <Card className="shadow-soft">
        <CardHeader><CardTitle>Daftar Kelas ({list.length})</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2">Nama</th><th className="py-2">Tingkat</th><th></th></tr></thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id} className="border-b hover:bg-muted/40">
                  <td className="py-2 font-medium">{c.name}</td>
                  <td className="py-2">{c.grade_level ?? "-"}</td>
                  <td className="py-2 text-right">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(c); setForm({ name: c.name, grade_level: c.grade_level?.toString() ?? "" }); setOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(c.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={3} className="text-center py-8 text-muted-foreground">Belum ada kelas.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit" : "Tambah"} Kelas</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div><Label>Nama</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="contoh: 7A" /></div>
            <div><Label>Tingkat</Label><Input type="number" value={form.grade_level} onChange={(e) => setForm({ ...form, grade_level: e.target.value })} placeholder="7" /></div>
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
