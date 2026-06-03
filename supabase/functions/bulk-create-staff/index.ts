// Admin-only: bulk create staff accounts (guru/wali_kelas/kepala_sekolah/kantin) from CSV rows
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Role = "guru" | "wali_kelas" | "kepala_sekolah" | "kantin" | "admin";

interface InRow {
  email: string;
  password?: string;
  full_name: string;
  role: Role;
  class_names?: string; // comma-separated, for guru access; for wali_kelas takes first only
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: roles } = await userClient.from("user_roles").select("role").eq("user_id", user.id);
    if (!(roles ?? []).some((r: any) => r.role === "admin"))
      return new Response(JSON.stringify({ error: "Admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const rows: InRow[] = Array.isArray(body?.staff) ? body.staff : [];
    if (!rows.length) return new Response(JSON.stringify({ error: "No rows" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: classes } = await admin.from("classes").select("id,name");
    const classMap = new Map<string, string>();
    (classes ?? []).forEach((c: any) => classMap.set(String(c.name).toLowerCase(), c.id));

    const results: any[] = [];
    for (const r of rows) {
      if (!r.email || !r.full_name || !r.role) { results.push({ email: r.email, ok: false, error: "email/full_name/role wajib" }); continue; }
      const password = r.password && r.password.length >= 6
        ? r.password
        : (crypto.randomUUID().replace(/-/g, "").slice(0, 10) + "A!");
      const { data: created, error: ce } = await admin.auth.admin.createUser({
        email: r.email, password, email_confirm: true,
        user_metadata: { full_name: r.full_name, role: r.role },
      });
      let uid: string | null = null;
      if (ce) {
        const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
        uid = list?.users.find((u: any) => u.email === r.email)?.id ?? null;
        if (!uid) { results.push({ email: r.email, ok: false, error: ce.message }); continue; }
      } else uid = created.user!.id;

      await admin.from("user_roles").delete().eq("user_id", uid);
      await admin.from("user_roles").insert({ user_id: uid, role: r.role });

      const classNames = (r.class_names ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      const classIds = classNames.map((n) => classMap.get(n.toLowerCase())).filter(Boolean) as string[];
      if (r.role === "guru" && classIds.length) {
        await admin.from("teacher_class_access").insert(classIds.map((c) => ({ teacher_id: uid, class_id: c })));
      }
      if (r.role === "wali_kelas" && classIds.length) {
        await admin.from("classes").update({ homeroom_teacher_id: uid }).eq("id", classIds[0]);
      }
      results.push({ email: r.email, ok: true, password });
    }

    await admin.from("audit_logs").insert({
      actor_id: user.id, actor_email: user.email,
      action: "bulk_create_staff", entity: "user", entity_id: null,
      detail: { count: rows.length, ok: results.filter((r) => r.ok).length },
    });

    return new Response(JSON.stringify({ results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
