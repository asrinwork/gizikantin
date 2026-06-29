import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  Utensils,
  ShoppingCart,
  Target,
  LogOut,
  Salad,
  Menu,
  X,
  ClipboardList,
  School,
  UserCog,
  BarChart3,
  UserCircle,
  Package,
  ScrollText,
  BookOpen,
  Gift,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: any; roles?: string[] };

const NAV: NavItem[] = [
  { to: "/", label: "Beranda", icon: LayoutDashboard },
  // Siswa
  { to: "/menu", label: "Pesan Makanan", icon: Utensils, roles: ["siswa"] },
  { to: "/orders", label: "Pesananku", icon: ClipboardList, roles: ["siswa"] },
  { to: "/profil", label: "Profil", icon: UserCircle, roles: ["siswa"] },
  { to: "/edukasi", label: "Edukasi Gizi", icon: BookOpen },
  // Kantin
  { to: "/pesanan-masuk", label: "Pesanan Masuk", icon: Package, roles: ["kantin", "admin"] },
  { to: "/transaksi", label: "Kasir POS", icon: ShoppingCart, roles: ["kantin", "admin"] },
  { to: "/makanan", label: "Menu Makanan", icon: Utensils, roles: ["kantin", "admin"] },
  // Monitoring (Guru/Wali/Kepsek/Admin)
  { to: "/grafik", label: "Grafik & Alert", icon: BarChart3, roles: ["guru", "wali_kelas", "kepala_sekolah", "admin"] },
  { to: "/siswa", label: "Data Siswa", icon: Users, roles: ["guru", "wali_kelas", "kepala_sekolah", "admin"] },
  // Admin only
  { to: "/kelas", label: "Kelas", icon: School, roles: ["admin"] },
  { to: "/users", label: "User & Peran", icon: UserCog, roles: ["admin"] },
  { to: "/target", label: "Target Gizi", icon: Target, roles: ["admin"] },
  { to: "/audit", label: "Audit Log", icon: ScrollText, roles: ["admin"] },
];

export const AppLayout = () => {
  const { user, roles, signOut, hasRole } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  const visible = NAV.filter((n) => !n.roles || n.roles.some((r) => hasRole(r as any)));

  const handleSignOut = async () => {
    await signOut();
    nav("/auth");
  };

  const SidebarBody = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-6 py-5 border-b border-sidebar-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-primary shadow-soft">
          <Salad className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-sm font-semibold text-sidebar-foreground">GiziKantin</h1>
          <p className="text-xs text-muted-foreground">Pemantauan Gizi</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {visible.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-soft"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-4 space-y-2">
        <div>
          <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.email}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {roles.map((r) => (
              <span
                key={r}
                className="inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase text-accent-foreground"
              >
                {r}
              </span>
            ))}
          </div>
        </div>
        <Button onClick={handleSignOut} variant="outline" size="sm" className="w-full">
          <LogOut className="h-4 w-4 mr-2" />
          Keluar
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <header className="md:hidden sticky top-0 z-40 flex items-center justify-between border-b bg-card px-4 py-3 shadow-soft">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary">
            <Salad className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-semibold">GiziKantin</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setOpen(!open)}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </header>

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-sidebar border-r border-sidebar-border">
          {SidebarBody}
        </aside>

        {/* Mobile drawer */}
        {open && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-foreground/40" onClick={() => setOpen(false)} />
            <aside className="absolute left-0 top-0 h-full w-72 bg-sidebar shadow-elevated animate-fade-in">
              {SidebarBody}
            </aside>
          </div>
        )}

        <main className="flex-1 md:pl-64">
          <div className="container max-w-6xl py-6 md:py-10 animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
