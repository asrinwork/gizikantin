import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { RichTextEditor } from "@/components/RichTextEditor";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, BookOpen, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";

interface Article {
  id: string;
  title: string;
  summary: string | null;
  body: string;
  cover_url: string | null;
  category: string;
  published: boolean;
  author_id: string | null;
  created_at: string;
}

const CATEGORIES = ["umum", "makro", "mikro", "hidrasi", "jajan_sehat", "obesitas", "anemia"];
const empty = { title: "", summary: "", body: "", cover_url: "", category: "umum", published: true };

const Education = () => {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const [items, setItems] = useState<Article[]>([]);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<Article | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Article | null>(null);
  const [form, setForm] = useState<any>(empty);

  const load = async () => {
    const { data } = await supabase.from("education_content").select("*").order("created_at", { ascending: false });
    setItems((data ?? []) as any);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() =>
    items.filter((i) =>
      (i.title + " " + (i.summary ?? "") + " " + i.category).toLowerCase().includes(query.toLowerCase())
    ), [items, query]);

  const startNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const startEdit = (a: Article) => {
    setEditing(a);
    setForm({ title: a.title, summary: a.summary ?? "", body: a.body, cover_url: a.cover_url ?? "", category: a.category, published: a.published });
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...form, summary: form.summary || null, cover_url: form.cover_url || null };
    if (editing) {
      const { error } = await supabase.from("education_content").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      await logAudit("update_education", "education", editing.id, { title: payload.title });
      toast.success("Konten diperbarui");
    } else {
      const { data, error } = await supabase.from("education_content").insert({ ...payload, author_id: user?.id }).select("id").single();
      if (error) return toast.error(error.message);
      await logAudit("create_education", "education", data?.id ?? null, { title: payload.title });
      toast.success("Konten dibuat");
    }
    setOpen(false); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Hapus konten ini?")) return;
    const { error } = await supabase.from("education_content").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await logAudit("delete_education", "education", id, {});
    toast.success("Dihapus"); load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><BookOpen className="h-7 w-7 text-primary" /> Edukasi Gizi</h1>
          <p className="text-muted-foreground">Artikel & tips gizi untuk siswa</p>
        </div>
        {isAdmin && (
          <Button onClick={startNew}><Plus className="h-4 w-4 mr-2" />Tulis Konten</Button>
        )}
      </div>

      <div className="relative max-w-md">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Cari artikel..." value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <Card className="shadow-soft"><CardContent className="p-12 text-center text-muted-foreground">
          <Sparkles className="h-10 w-10 mx-auto mb-3 text-muted-foreground/60" />
          Belum ada konten edukasi.
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a) => (
            <Card key={a.id} className="shadow-soft overflow-hidden flex flex-col hover:shadow-elevated transition-shadow">
              {a.cover_url && (
                <div className="aspect-video bg-muted overflow-hidden">
                  <img src={a.cover_url} alt={a.title} className="w-full h-full object-cover" loading="lazy" />
                </div>
              )}
              <CardContent className="p-4 flex-1 flex flex-col gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="capitalize">{a.category.replace("_", " ")}</Badge>
                  {!a.published && <Badge variant="outline">Draft</Badge>}
                </div>
                <h3 className="font-semibold leading-snug line-clamp-2">{a.title}</h3>
                {a.summary && <p className="text-sm text-muted-foreground line-clamp-3">{a.summary}</p>}
                <div className="mt-auto flex justify-between items-center pt-2">
                  <Button variant="link" size="sm" className="px-0" onClick={() => setActive(a)}>Baca →</Button>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(a)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove(a.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Reader */}
      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {active && (
            <>
              <DialogHeader>
                <Badge variant="secondary" className="capitalize w-fit">{active.category.replace("_", " ")}</Badge>
                <DialogTitle className="text-2xl">{active.title}</DialogTitle>
                {active.summary && <p className="text-muted-foreground">{active.summary}</p>}
              </DialogHeader>
              {active.cover_url && <img src={active.cover_url} alt="" className="w-full rounded-md" />}
              {/[<][a-z]/i.test(active.body)
                ? <div className="prose prose-sm max-w-none text-foreground [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:text-lg [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-primary [&_blockquote]:pl-3 [&_blockquote]:italic [&_img]:rounded [&_img]:my-2 [&_pre]:bg-muted [&_pre]:p-2 [&_pre]:rounded" dangerouslySetInnerHTML={{ __html: active.body }} />
                : <div className="prose prose-sm max-w-none whitespace-pre-wrap text-foreground">{active.body}</div>}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Editor (admin) */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit" : "Tulis"} Konten Edukasi</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div><Label>Judul</Label><Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Ringkasan</Label><Input value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} placeholder="Satu baris ringkasan menarik" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Kategori</Label>
                <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c.replace("_", " ")}</option>)}
                </select>
              </div>
              <div>
                <Label>URL Gambar Sampul</Label>
                <Input value={form.cover_url} onChange={(e) => setForm({ ...form, cover_url: e.target.value })} placeholder="https://..." />
              </div>
            </div>
            <div><Label>Isi Konten</Label><RichTextEditor value={form.body} onChange={(html) => setForm({ ...form, body: html })} placeholder="Tulis artikel di sini... (gunakan toolbar untuk format teks)" /></div>
            <div className="flex items-center gap-2">
              <Switch checked={form.published} onCheckedChange={(v) => setForm({ ...form, published: v })} />
              <Label className="!mt-0">Publikasikan sekarang</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
              <Button type="submit">{editing ? "Simpan" : "Terbitkan"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Education;
