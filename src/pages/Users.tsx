import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, Upload, Shield, Loader2, KeyRound, Copy } from "lucide-react";
import { logAudit } from "@/lib/audit";
import { parseCSV } from "@/lib/csv";

type Role = "admin" | "guru" | "wali_kelas" | "kepala_sekolah" | "kantin" | "siswa";
interface Row { user_id: string; role: Role; }
interface Profile { id: string; full_name: string; email: string | null; }
interface ClassRow { id: string; name: string; }

const Users = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [teacherAccess, setTeacherAccess] = useState<Record<string, string[]>>({});

  // create user dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", full_name: "", role: "guru" as Role, class_ids: [] as string[], homeroom_class_id: "" });

  // bulk import dialog
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkResults, setBulkResults] = useState<any[] | null>(null);

  // teacher access dialog
  const [accessOpen, setAccessOpen] = useState(false);
  const [accessFor, setAccessFor] = useState<string | null>(null);
  const [accessSel, setAccessSel] = useState<string[]>([]);

  // reset password dialog
  const [resetOpen, setResetOpen] = useState(false);
  const [resetFor, setResetFor] = useState<{ id: string; name: string; email: string } | null>(null);
  const [resetMode, setResetMode] = useState<"auto" | "manual">("auto");
  const [resetPwd, setResetPwd] = useState("");
  const [resetResult, setResetResult] = useState<string | null>(null);

  const load = async () => {
    const [{ data: r }, { data: p }, { data: c }, { data: tca }] = await Promise.all([
      supabase.from("user_roles").select("user_id,role").order("role"),
      supabase.from("profiles").select("id,full_name,email"),
      supabase.from("classes").select("id,name").order("name"),
      supabase.from("teacher_class_access").select("teacher_id,class_id"),
    ]);
    setRows((r ?? []) as any);
    const map: Record<string, Profile> = {};
    (p ?? []).forEach((x: any) => { map[x.id] = x; });
    setProfiles(map);
    setClasses((c ?? []) as any);
    const acc: Record<string, string[]> = {};
    (tca ?? []).forEach((x: any) => { (acc[x.teacher_id] ??= []).push(x.class_id); });
    setTeacherAccess(acc);
  };
  useEffect(() => { load(); }, []);

  const addRole = async (user_id: string, role: Role) => {
    const { error } = await supabase.from("user_roles").insert({ user_id, role });
    if (error) return toast.error(error.message);
    await logAudit("update_user_role", "user", user_id, { add: role });
    toast.success("Peran ditambahkan"); load();
  };

  const removeRole = async (user_id: string, role: Role) => {
    const { error } = await supabase.from("user_roles").delete().eq("user_id", user_id).eq("role", role);
    if (error) return toast.error(error.message);
    await logAudit("delete_user_role", "user", user_id, { remove: role });
    toast.success("Peran dihapus"); load();
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("admin-create-user", {
      body: {
        email: form.email, password: form.password || undefined, full_name: form.full_name, role: form.role,
        class_ids: form.role === "guru" ? form.class_ids : undefined,
        homeroom_class_id: form.role === "wali_kelas" ? form.homeroom_class_id : undefined,
      },
    });
    setBusy(false);
    let errMsg: string | null = (data as any)?.error ?? null;
    if (!errMsg && error) {
      try { errMsg = (await (error as any).context?.json?.())?.error ?? error.message; }
      catch { errMsg = error.message; }
    }
    if (errMsg) return toast.error(errMsg);
    const generated = (data as any)?.password as string | undefined;
    toast.success("Akun berhasil dibuat");
    setCreateOpen(false);
    setForm({ email: "", password: "", full_name: "", role: "guru", class_ids: [], homeroom_class_id: "" });
    if (generated) {
      setResetFor({ id: (data as any).user_id, name: form.full_name, email: form.email });
      setResetResult(generated); setResetOpen(true);
    }
    load();
  };

  const runBulk = async () => {
    const parsed = parseCSV(bulkText);
    if (!parsed.length) return toast.error("CSV kosong / tidak valid");
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("bulk-create-staff", { body: { staff: parsed } });
    setBusy(false);
    if (error || (data as any)?.error) return toast.error((data as any)?.error ?? error?.message);
    setBulkResults((data as any).results ?? []);
    toast.success("Import selesai"); load();
  };

  const openAccess = (uid: string) => {
    setAccessFor(uid); setAccessSel(teacherAccess[uid] ?? []); setAccessOpen(true);
  };
  const saveAccess = async () => {
    if (!accessFor) return;
    await supabase.from("teacher_class_access").delete().eq("teacher_id", accessFor);
    if (accessSel.length) {
      const { error } = await supabase.from("teacher_class_access").insert(
        accessSel.map((c) => ({ teacher_id: accessFor, class_id: c }))
      );
      if (error) return toast.error(error.message);
    }
    await logAudit("assign_teacher_access", "user", accessFor, { class_ids: accessSel });
    toast.success("Akses tersimpan"); setAccessOpen(false); load();
  };

  // exclude pure-siswa accounts (siswa cannot hold other staff roles)
  const grouped = rows.reduce<Record<string, Role[]>>((acc, r) => {
    (acc[r.user_id] ??= []).push(r.role);
    return acc;
  }, {});
  const staffGrouped = Object.fromEntries(
    Object.entries(grouped).filter(([, rs]) => rs.some((r) => r !== "siswa"))
  );

  const openReset = (uid: string) => {
    const p = profiles[uid];
    setResetFor({ id: uid, name: p?.full_name || "(tanpa nama)", email: p?.email || "" });
    setResetMode("auto"); setResetPwd(""); setResetResult(null); setResetOpen(true);
  };
  const runReset = async () => {
    if (!resetFor) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("admin-reset-password", {
      body: { user_id: resetFor.id, password: resetMode === "manual" ? resetPwd : undefined },
    });
    setBusy(false);
    if (error || (data as any)?.error) return toast.error((data as any)?.error ?? error?.message);
    setResetResult((data as any).password);
    toast.success("Password berhasil direset");
  };

  const downloadTemplate = () => {
    const t = "email,password,full_name,role,class_names\nguru1@sekolah.id,Pass#1234,Budi Santoso,guru,\"7A,7B\"\nwali7a@sekolah.id,Pass#1234,Siti Wali,wali_kelas,7A\nkepsek@sekolah.id,Pass#1234,Pak Kepsek,kepala_sekolah,\nkantin1@sekolah.id,Pass#1234,Ibu Kantin,kantin,\n";
    const blob = new Blob([t], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "staff_template.csv"; a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Kelola User</h1>
          <p className="text-muted-foreground">Buat akun, atur peran & hak akses monitoring</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setBulkText(""); setBulkResults(null); setBulkOpen(true); }}>
            <Upload className="h-4 w-4 mr-2" /> Import CSV Staff
          </Button>
          <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-2" /> Buat User</Button>
        </div>
      </div>

      <Card className="shadow-soft">
        <CardHeader><CardTitle>Pengguna & Peran ({Object.keys(staffGrouped).length})</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Object.entries(staffGrouped).map(([uid, roles]) => {
              const p = profiles[uid];
              const isGuru = roles.includes("guru");
              const access = teacherAccess[uid] ?? [];
              return (
                <div key={uid} className="flex flex-wrap items-center gap-2 justify-between rounded-md border p-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{p?.full_name || "(tanpa nama)"}</p>
                    <p className="text-xs text-muted-foreground truncate">{p?.email || uid}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {roles.map((r) => (
                        <Badge key={r} variant="secondary" className="capitalize">
                          {r.replace("_", " ")}
                          <button onClick={() => removeRole(uid, r)} className="ml-1.5 text-destructive hover:underline">×</button>
                        </Badge>
                      ))}
                      {isGuru && (
                        <Badge variant="outline" className="text-xs">
                          Akses: {access.length ? `${access.length} kelas` : "belum ada"}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {isGuru && (
                      <Button size="sm" variant="outline" onClick={() => openAccess(uid)}>
                        <Shield className="h-3.5 w-3.5 mr-1" /> Hak Akses Kelas
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => openReset(uid)}>
                      <KeyRound className="h-3.5 w-3.5 mr-1" /> Reset Password
                    </Button>
                    <Select onValueChange={(v) => addRole(uid, v as Role)}>
                      <SelectTrigger className="w-40"><SelectValue placeholder="+ Tambah peran" /></SelectTrigger>
                      <SelectContent>
                        {(["admin","guru","wali_kelas","kepala_sekolah","kantin"] as Role[]).filter((r) => !roles.includes(r)).map((r) => (
                          <SelectItem key={r} value={r} className="capitalize">{r.replace("_"," ")}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              );
            })}
            {Object.keys(staffGrouped).length === 0 && <p className="text-center py-8 text-muted-foreground">Belum ada user staff.</p>}
          </div>
        </CardContent>
      </Card>

      {/* Create user */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Buat User Baru</DialogTitle><DialogDescription>Hanya admin yang dapat membuat akun.</DialogDescription></DialogHeader>
          <form onSubmit={createUser} className="space-y-3">
            <div><Label>Nama Lengkap</Label><Input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div><Label>Email</Label><Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Password</Label><Input type="text" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
            <div>
              <Label>Peran</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as Role, class_ids: [], homeroom_class_id: "" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="kepala_sekolah">Kepala Sekolah</SelectItem>
                  <SelectItem value="wali_kelas">Wali Kelas</SelectItem>
                  <SelectItem value="guru">Guru</SelectItem>
                  <SelectItem value="kantin">Kantin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.role === "guru" && (
              <div>
                <Label>Akses Kelas (boleh memantau)</Label>
                <div className="max-h-40 overflow-auto rounded border p-2 space-y-1">
                  {classes.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={form.class_ids.includes(c.id)} onCheckedChange={(v) => {
                        setForm({ ...form, class_ids: v ? [...form.class_ids, c.id] : form.class_ids.filter((x) => x !== c.id) });
                      }} />
                      {c.name}
                    </label>
                  ))}
                  {!classes.length && <p className="text-xs text-muted-foreground">Belum ada kelas.</p>}
                </div>
              </div>
            )}
            {form.role === "wali_kelas" && (
              <div>
                <Label>Wali untuk Kelas</Label>
                <Select value={form.homeroom_class_id} onValueChange={(v) => setForm({ ...form, homeroom_class_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Pilih kelas" /></SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Batal</Button>
              <Button type="submit" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Buat</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bulk import staff */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Import CSV Staff</DialogTitle>
            <DialogDescription>Kolom: <code>email,password,full_name,role,class_names</code>. Role: guru, wali_kelas, kepala_sekolah, kantin, admin. <code>class_names</code> dipisah koma.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>Unduh template</Button>
            <textarea className="w-full h-40 rounded border p-2 font-mono text-xs" placeholder="email,password,full_name,role,class_names" value={bulkText} onChange={(e) => setBulkText(e.target.value)} />
            {bulkResults && (
              <div className="rounded border p-2 max-h-40 overflow-auto text-xs">
                {bulkResults.map((r, i) => (
                  <div key={i} className={r.ok ? "text-emerald-700" : "text-destructive"}>
                    {r.email} — {r.ok ? `OK (pwd: ${r.password})` : `GAGAL: ${r.error}`}
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>Tutup</Button>
            <Button onClick={runBulk} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Proses</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Teacher access */}
      <Dialog open={accessOpen} onOpenChange={setAccessOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Hak Akses Monitoring Kelas</DialogTitle>
            <DialogDescription>Pilih kelas yang boleh dipantau oleh guru ini.</DialogDescription>
          </DialogHeader>
          <div className="max-h-72 overflow-auto space-y-1">
            {classes.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm rounded px-2 py-1 hover:bg-muted">
                <Checkbox checked={accessSel.includes(c.id)} onCheckedChange={(v) => {
                  setAccessSel(v ? [...accessSel, c.id] : accessSel.filter((x) => x !== c.id));
                }} />
                {c.name}
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccessOpen(false)}>Batal</Button>
            <Button onClick={saveAccess}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset password */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              {resetFor ? <>Akun: <b>{resetFor.name}</b> ({resetFor.email})</> : null}
            </DialogDescription>
          </DialogHeader>
          {!resetResult ? (
            <div className="space-y-3">
              <div className="flex gap-2 text-sm">
                <label className="flex items-center gap-1.5"><input type="radio" checked={resetMode === "auto"} onChange={() => setResetMode("auto")} /> Buat password acak</label>
                <label className="flex items-center gap-1.5"><input type="radio" checked={resetMode === "manual"} onChange={() => setResetMode("manual")} /> Tentukan sendiri</label>
              </div>
              {resetMode === "manual" && (
                <div>
                  <Label>Password Baru (min 6)</Label>
                  <Input type="text" minLength={6} value={resetPwd} onChange={(e) => setResetPwd(e.target.value)} />
                </div>
              )}
              <p className="text-xs text-muted-foreground">Password lama tidak dapat dilihat. Setelah direset, password baru akan ditampilkan satu kali — pastikan disampaikan ke pengguna.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Password baru (catat sekarang)</Label>
              <div className="flex gap-2">
                <Input readOnly value={resetResult} className="font-mono" />
                <Button type="button" variant="outline" onClick={() => { navigator.clipboard.writeText(resetResult); toast.success("Disalin"); }}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            {!resetResult ? (
              <>
                <Button variant="outline" onClick={() => setResetOpen(false)}>Batal</Button>
                <Button onClick={runReset} disabled={busy || (resetMode === "manual" && resetPwd.length < 6)}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Reset
                </Button>
              </>
            ) : (
              <Button onClick={() => setResetOpen(false)}>Selesai</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Users;
