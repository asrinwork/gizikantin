
-- teacher class access
CREATE TABLE IF NOT EXISTS public.teacher_class_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, class_id)
);
ALTER TABLE public.teacher_class_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage teacher access"
  ON public.teacher_class_access FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Teacher read own access"
  ON public.teacher_class_access FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'kepala_sekolah'));

-- audit logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read audit logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Authenticated insert own audit logs"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- student notes
CREATE TABLE IF NOT EXISTS public.student_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  author_id uuid NOT NULL,
  severity text NOT NULL DEFAULT 'info', -- info | warning | alert
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.student_notes ENABLE ROW LEVEL SECURITY;

-- can_view_student helper
CREATE OR REPLACE FUNCTION public.can_view_student(_uid uuid, _student_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.has_role(_uid,'admin')
    OR public.has_role(_uid,'kepala_sekolah')
    OR public.has_role(_uid,'kantin')
    OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = _student_id AND s.user_id = _uid)
    OR EXISTS (
      SELECT 1 FROM public.students s
      JOIN public.classes c ON c.id = s.class_id
      WHERE s.id = _student_id
        AND public.has_role(_uid,'wali_kelas')
        AND c.homeroom_teacher_id = _uid
    )
    OR EXISTS (
      SELECT 1 FROM public.students s
      JOIN public.teacher_class_access tca ON tca.class_id = s.class_id
      WHERE s.id = _student_id
        AND public.has_role(_uid,'guru')
        AND tca.teacher_id = _uid
    );
$$;

REVOKE EXECUTE ON FUNCTION public.can_view_student(uuid, uuid) FROM anon;

-- student notes policies
CREATE POLICY "Read student notes"
  ON public.student_notes FOR SELECT TO authenticated
  USING (public.can_view_student(auth.uid(), student_id));

CREATE POLICY "Staff create student notes"
  ON public.student_notes FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND public.can_view_student(auth.uid(), student_id)
    AND (
      public.has_role(auth.uid(),'admin')
      OR public.has_role(auth.uid(),'kepala_sekolah')
      OR public.has_role(auth.uid(),'wali_kelas')
      OR public.has_role(auth.uid(),'guru')
    )
  );

CREATE POLICY "Author or admin delete notes"
  ON public.student_notes FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- Replace students/orders/transactions read policies to use can_view_student
DROP POLICY IF EXISTS "Read students" ON public.students;
CREATE POLICY "Read students"
  ON public.students FOR SELECT TO authenticated
  USING (public.can_view_student(auth.uid(), id));

DROP POLICY IF EXISTS "Read orders" ON public.orders;
CREATE POLICY "Read orders"
  ON public.orders FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'kantin')
    OR public.can_view_student(auth.uid(), student_id)
  );

DROP POLICY IF EXISTS "Read order items" ON public.order_items;
CREATE POLICY "Read order items"
  ON public.order_items FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'kantin')
    OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND public.can_view_student(auth.uid(), o.student_id))
  );

DROP POLICY IF EXISTS "Authenticated read transactions" ON public.transactions;
CREATE POLICY "Read transactions scoped"
  ON public.transactions FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'kantin')
    OR public.can_view_student(auth.uid(), student_id)
  );

DROP POLICY IF EXISTS "Read daily targets" ON public.daily_nutrition_targets;
CREATE POLICY "Read daily targets"
  ON public.daily_nutrition_targets FOR SELECT TO authenticated
  USING (public.can_view_student(auth.uid(), student_id));
