import { supabase } from "@/integrations/supabase/client";

export type AuditAction =
  | "create_user" | "update_user_role" | "delete_user_role" | "bulk_create_students" | "bulk_create_staff"
  | "create_class" | "update_class" | "delete_class" | "assign_homeroom" | "assign_teacher_access" | "revoke_teacher_access"
  | "create_food" | "update_food" | "delete_food" | "bulk_create_foods"
  | "create_education" | "update_education" | "delete_education"
  | "update_nutrition_target";

export async function logAudit(action: AuditAction, entity: string, entity_id: string | null, detail: any = {}) {
  try {
    await supabase.rpc("log_audit", {
      _action: action,
      _entity: entity,
      _entity_id: entity_id,
      _detail: detail,
    });
  } catch (e) {
    console.warn("audit log failed", e);
  }
}
