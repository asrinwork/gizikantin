import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Salad, Loader2 } from "lucide-react";

const Auth = () => {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);

  // login
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // signup
  const [sName, setSName] = useState("");
  const [sEmail, setSEmail] = useState("");
  const [sPass, setSPass] = useState("");
  const [sRole, setSRole] = useState<"guru" | "kantin" | "admin">("guru");

  useEffect(() => {
    if (!loading && user) nav("/", { replace: true });
  }, [user, loading, nav]);

  const fillDemo = (role: "admin" | "guru" | "kantin") => {
    const map = {
      admin: { email: "admin@gizikantin.demo", password: "Admin#1234" },
      guru: { email: "guru@gizikantin.demo", password: "Guru#1234" },
      kantin: { email: "kantin@gizikantin.demo", password: "Kantin#1234" },
    } as const;
    setEmail(map[role].email);
    setPassword(map[role].password);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Berhasil masuk");
    nav("/", { replace: true });
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: sEmail,
      password: sPass,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: sName, role: sRole },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Akun dibuat. Silakan masuk.");
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
            <CardTitle>Selamat datang</CardTitle>
            <CardDescription>Masuk atau buat akun untuk melanjutkan</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Masuk</TabsTrigger>
                <TabsTrigger value="signup">Daftar</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4 pt-4">
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
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="su-name">Nama Lengkap</Label>
                    <Input id="su-name" required value={sName} onChange={(e) => setSName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-email">Email</Label>
                    <Input id="su-email" type="email" required value={sEmail} onChange={(e) => setSEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-pass">Password</Label>
                    <Input id="su-pass" type="password" required minLength={6} value={sPass} onChange={(e) => setSPass(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Peran</Label>
                    <Select value={sRole} onValueChange={(v: any) => setSRole(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="guru">Guru</SelectItem>
                        <SelectItem value="kantin">Kantin</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Pengguna pertama otomatis menjadi Admin.
                    </p>
                  </div>
                  <Button type="submit" disabled={busy} className="w-full">
                    {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Daftar
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
