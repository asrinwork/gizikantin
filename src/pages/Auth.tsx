import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Salad, Loader2 } from "lucide-react";

const Auth = () => {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [allowBootstrap, setAllowBootstrap] = useState(false);
  const [mode, setMode] = useState<"login" | "bootstrap">("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [bName, setBName] = useState("");

  useEffect(() => {
    if (!loading && user) nav("/", { replace: true });
  }, [user, loading, nav]);

  useEffect(() => {
    supabase.rpc("any_admin_exists").then(({ data }) => {
      const exists = !!data;
      setAllowBootstrap(!exists);
      if (!exists) setMode("bootstrap");
    });
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Berhasil masuk"); nav("/", { replace: true });
  };

  const handleBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${window.location.origin}/`, data: { full_name: bName, role: "admin" } },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Admin pertama dibuat. Silakan masuk.");
    setAllowBootstrap(false); setMode("login");
  };

  return (
    <div className="min-h-screen gradient-soft flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary shadow-glow">
            <Salad className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">GiziKantin</h1>
          <p className="text-sm text-muted-foreground">Pemantauan Gizi Siswa Berbasis Kantin Sekolah</p>
        </div>

        <Card className="shadow-elevated">
          <CardHeader>
            <CardTitle>{mode === "bootstrap" ? "Setup Admin Pertama" : "Masuk"}</CardTitle>
            <CardDescription>
              {mode === "bootstrap"
                ? "Belum ada admin di sistem. Daftarkan admin pertama untuk memulai."
                : "Akun dibuat oleh admin. Hubungi admin jika Anda belum punya akses."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {mode === "login" ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input id="login-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-pass">Password</Label>
                  <Input id="login-pass" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" disabled={busy} className="w-full">
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Masuk
                </Button>
                {allowBootstrap && (
                  <Button type="button" variant="ghost" className="w-full" onClick={() => setMode("bootstrap")}>
                    Setup admin pertama
                  </Button>
                )}
              </form>
            ) : (
              <form onSubmit={handleBootstrap} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nama Lengkap</Label>
                  <Input required value={bName} onChange={(e) => setBName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" disabled={busy} className="w-full">
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Buat Admin
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
