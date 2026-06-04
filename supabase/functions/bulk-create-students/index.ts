// Bulk create student accounts + profiles. Admin only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface InRow {
  nis: string;
  full_name: string;
  class_name?: string;
  class_id?: string | null;
  gender?: "L" | "P" | null;
  birth_date?: string | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  activity_level?: string | null;
  email?: string | null;
  password?: string | null;
}

const EMAIL_DOMAIN = "sekolah.local";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller + role
    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: uerr } = await userClient.auth.getUser();
    if (uerr || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roles } = await userClient.from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const rows: InRow[] = Array.isArray(body?.students) ? body.students : [];
    if (rows.length === 0) {
      return new Response(JSON.stringify({ error: "No students provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    // Load classes for name->id mapping
    const { data: classes } = await admin.from("classes").select("id,name");
    const classMap = new Map<string, string>();
    (classes ?? []).forEach((c: any) => classMap.set(String(c.name).toLowerCase(), c.id));

    const results: any[] = [];
    for (const r of rows) {
      if (!r.nis || !r.full_name) {
        results.push({ nis: r.nis, ok: false, error: "NIS dan nama wajib" });
        continue;
      }
      const email = `${String(r.nis).trim()}@${EMAIL_DOMAIN}`;
      const password = String(r.nis).trim().padEnd(6, "0");

      // Auto-create class if name given but not found
      let classId = r.class_id ?? null;
      if (!classId && r.class_name) {
        const key = r.class_name.toLowerCase();
        classId = classMap.get(key) ?? null;
        if (!classId) {
          const { data: nc } = await admin.from("classes").insert({ name: r.class_name }).select("id").single();
          if (nc) { classId = nc.id; classMap.set(key, nc.id); }
        }
      }

      // Create or find auth user
      let userId: string | null = null;
      const { data: created, error: ce } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { full_name: r.full_name, role: "siswa" },
      });
      if (ce) {
        // user may already exist — try to find
        if (String(ce.message).toLowerCase().includes("registered") || String(ce.message).toLowerCase().includes("already")) {
          const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
          userId = list?.users.find((u: any) => u.email === email)?.id ?? null;
        }
        if (!userId) {
          results.push({ nis: r.nis, ok: false, error: ce.message });
          continue;
        }
      } else {
        userId = created.user?.id ?? null;
      }
      if (!userId) {
        results.push({ nis: r.nis, ok: false, error: "Gagal membuat akun" });
        continue;
      }

      // Assign 'siswa' role (idempotent)
      await admin.from("user_roles").upsert({ user_id: userId, role: "siswa" }, { onConflict: "user_id,role" });

      // Upsert student record by NIS
      const studentPayload = {
        nis: String(r.nis).trim(),
        full_name: r.full_name,
        class_name: r.class_name ?? "",
        class_id: classId,
        gender: r.gender ?? null,
        birth_date: r.birth_date || null,
        height_cm: r.height_cm ?? null,
        weight_kg: r.weight_kg ?? null,
        activity_level: r.activity_level ?? "light",
        user_id: userId,
      };
      const { error: se } = await admin.from("students").upsert(studentPayload, { onConflict: "nis" });
      if (se) {
        results.push({ nis: r.nis, ok: false, error: se.message });
        continue;
      }
      results.push({ nis: r.nis, ok: true, email, password });
    }

    await admin.from("audit_logs").insert({
      actor_id: user.id, actor_email: user.email,
      action: "bulk_create_students", entity: "student", entity_id: null,
      detail: { count: rows.length, ok: results.filter((r: any) => r.ok).length },
    });

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
