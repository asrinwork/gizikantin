
-- school_settings (single row)
CREATE TABLE public.school_settings (
  id int PRIMARY KEY DEFAULT 1,
  school_share_pct numeric NOT NULL DEFAULT 0.65,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT school_settings_single_row CHECK (id = 1),
  CONSTRAINT school_settings_share_range CHECK (school_share_pct > 0 AND school_share_pct <= 1)
);
GRANT SELECT ON public.school_settings TO authenticated;
GRANT SELECT ON public.school_settings TO anon;
GRANT ALL ON public.school_settings TO service_role;
ALTER TABLE public.school_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_settings_read_all" ON public.school_settings FOR SELECT USING (true);
CREATE POLICY "school_settings_admin_write" ON public.school_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.school_settings(id, school_share_pct) VALUES (1, 0.65) ON CONFLICT DO NOTHING;

-- mbg_entries
CREATE TABLE public.mbg_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  calories numeric NOT NULL CHECK (calories >= 0),
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mbg_entries TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.mbg_entries TO authenticated;
GRANT ALL ON public.mbg_entries TO service_role;
ALTER TABLE public.mbg_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mbg_read_all_auth" ON public.mbg_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "mbg_admin_write" ON public.mbg_entries FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX mbg_entries_date_idx ON public.mbg_entries(entry_date);

-- Update calc_daily_calories to multiply by school share
CREATE OR REPLACE FUNCTION public.calc_daily_calories(_student_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  s RECORD;
  age_yr NUMERIC;
  f RECORD;
  bmr NUMERIC;
  act_factor NUMERIC;
  fallback NUMERIC;
  share NUMERIC;
BEGIN
  SELECT school_share_pct INTO share FROM public.school_settings WHERE id = 1;
  share := COALESCE(share, 0.65);

  SELECT calories INTO fallback FROM public.nutrition_targets WHERE is_active LIMIT 1;
  fallback := COALESCE(fallback, 2000);

  SELECT gender, birth_date, height_cm, weight_kg, activity_level
    INTO s FROM public.students WHERE id = _student_id;
  IF s IS NULL OR s.height_cm IS NULL OR s.weight_kg IS NULL OR s.birth_date IS NULL THEN
    RETURN ROUND(fallback * share);
  END IF;
  age_yr := GREATEST(0, EXTRACT(YEAR FROM age(s.birth_date)));
  SELECT * INTO f FROM public.bmr_formulas
    WHERE gender = COALESCE(s.gender,'L')
      AND age_yr BETWEEN age_min AND age_max
    ORDER BY age_min DESC LIMIT 1;
  IF f IS NULL THEN
    SELECT * INTO f FROM public.bmr_formulas
      WHERE gender = COALESCE(s.gender,'L')
      ORDER BY age_max DESC LIMIT 1;
  END IF;
  IF f IS NULL THEN
    RETURN ROUND(fallback * share);
  END IF;
  bmr := f.coef_weight * s.weight_kg + f.coef_height * s.height_cm + f.constant;

  SELECT af.factor INTO act_factor FROM public.activity_factors af
    WHERE af.key = COALESCE(s.activity_level,'light') LIMIT 1;
  IF act_factor IS NULL THEN act_factor := 1.375; END IF;
  RETURN ROUND(bmr * act_factor * share);
END $function$;

-- Update today_calories to include MBG calories
CREATE OR REPLACE FUNCTION public.today_calories(_student_id uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE((
    SELECT SUM(t.quantity * f.calories) FROM public.transactions t
    JOIN public.foods f ON f.id = t.food_id
    WHERE t.student_id = _student_id AND t.consumed_at::date = CURRENT_DATE
  ),0)
  + COALESCE((
    SELECT SUM(o.total_calories) FROM public.orders o
    WHERE o.student_id = _student_id AND o.created_at::date = CURRENT_DATE
      AND o.status IN ('pending','ready')
  ),0)
  + COALESCE((
    SELECT SUM(m.calories) FROM public.mbg_entries m
    WHERE m.entry_date = CURRENT_DATE
  ),0);
$function$;
