// Admin-only: create a single user with role + (optional) staff profile / class assignment
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Role = "admin" | "guru" | "wali_kelas" | "kepala_sekolah" | "kantin" | "siswa";

interface Body {
  email: string;
  password: string;
  full_name: string;
  role: Role;
  class_ids?: string[]; // for guru: accessible classes
  homeroom_class_id?: string; // for wali_kelas: which class they own
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
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    if (!isAdmin) return new Response(JSON.stringify({ error: "Admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = (await req.json()) as Body;
    if (!body.email || !body.full_name || !body.role) {
      return new Response(JSON.stringify({ error: "email/full_name/role wajib" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const password = body.password && body.password.length >= 6
      ? body.password
      : (crypto.randomUUID().replace(/-/g, "").slice(0, 10) + "A!");

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    const { data: created, error: ce } = await admin.auth.admin.createUser({
      email: body.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: body.full_name, role: body.role },
    });
    if (ce) return new Response(JSON.stringify({ error: ce.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const uid = created.user!.id;

    // handle_new_user trigger already sets profile and a default role; force the requested role.
    await admin.from("user_roles").delete().eq("user_id", uid);
    await admin.from("user_roles").insert({ user_id: uid, role: body.role });

    if (body.role === "guru" && body.class_ids?.length) {
      await admin.from("teacher_class_access").insert(
        body.class_ids.map((c) => ({ teacher_id: uid, class_id: c }))
      );
    }
    if (body.role === "wali_kelas" && body.homeroom_class_id) {
      await admin.from("classes").update({ homeroom_teacher_id: uid }).eq("id", body.homeroom_class_id);
    }

    // audit
    await admin.from("audit_logs").insert({
      actor_id: user.id, actor_email: user.email,
      action: "create_user", entity: "user", entity_id: uid,
      detail: { email: body.email, full_name: body.full_name, role: body.role },
    });

    return new Response(JSON.stringify({ ok: true, user_id: uid }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
