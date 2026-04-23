// Seeds 3 demo accounts (admin, guru, kantin) using the service role.
// Public function, no JWT required.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Role = "admin" | "guru" | "kantin";

const DEMO: { email: string; password: string; full_name: string; role: Role }[] = [
  { email: "admin@gizikantin.demo",  password: "Admin#1234",  full_name: "Admin Sekolah",  role: "admin"  },
  { email: "guru@gizikantin.demo",   password: "Guru#1234",   full_name: "Guru Wali Kelas", role: "guru"  },
  { email: "kantin@gizikantin.demo", password: "Kantin#1234", full_name: "Petugas Kantin",  role: "kantin"},
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    const results: any[] = [];

    for (const u of DEMO) {
      // Try create (email-confirmed). If exists, update password & ensure profile/role.
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { full_name: u.full_name, role: u.role },
      });

      let userId = created?.user?.id;

      if (createErr && !userId) {
        // User likely exists — find and update.
        const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const existing = list.users.find((x) => x.email?.toLowerCase() === u.email);
        if (existing) {
          userId = existing.id;
          await admin.auth.admin.updateUserById(existing.id, {
            password: u.password,
            email_confirm: true,
            user_metadata: { full_name: u.full_name, role: u.role },
          });
        } else {
          results.push({ email: u.email, status: "error", error: createErr.message });
          continue;
        }
      }

      if (!userId) {
        results.push({ email: u.email, status: "error", error: "no user id" });
        continue;
      }

      // Ensure profile row
      await admin.from("profiles").upsert(
        { id: userId, full_name: u.full_name, email: u.email },
        { onConflict: "id" }
      );

      // Ensure role row (unique on user_id+role)
      const { data: existingRole } = await admin
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .eq("role", u.role)
        .maybeSingle();

      if (!existingRole) {
        await admin.from("user_roles").insert({ user_id: userId, role: u.role });
      }

      results.push({ email: u.email, password: u.password, role: u.role, status: "ok" });
    }

    return new Response(JSON.stringify({ ok: true, accounts: results }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
