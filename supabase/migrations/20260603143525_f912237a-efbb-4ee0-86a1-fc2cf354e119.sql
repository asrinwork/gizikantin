
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
BEGIN
  SELECT calories INTO fallback FROM public.nutrition_targets WHERE is_active LIMIT 1;
  fallback := COALESCE(fallback, 2000);

  SELECT gender, birth_date, height_cm, weight_kg, activity_level
    INTO s FROM public.students WHERE id = _student_id;
  IF s IS NULL OR s.height_cm IS NULL OR s.weight_kg IS NULL OR s.birth_date IS NULL THEN
    RETURN fallback;
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
    RETURN fallback;
  END IF;
  bmr := f.coef_weight * s.weight_kg + f.coef_height * s.height_cm + f.constant;

  SELECT af.factor INTO act_factor FROM public.activity_factors af
    WHERE af.key = COALESCE(s.activity_level,'light') LIMIT 1;
  IF act_factor IS NULL THEN act_factor := 1.375; END IF;
  RETURN ROUND(bmr * act_factor);
END $function$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE IF NOT EXISTS public.education_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT,
  body TEXT NOT NULL,
  cover_url TEXT,
  category TEXT NOT NULL DEFAULT 'umum',
  published BOOLEAN NOT NULL DEFAULT true,
  author_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.education_content TO authenticated;
GRANT ALL ON public.education_content TO service_role;

ALTER TABLE public.education_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "edu read published"
  ON public.education_content FOR SELECT
  TO authenticated
  USING (published = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "edu admin insert"
  ON public.education_content FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "edu admin update"
  ON public.education_content FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "edu admin delete"
  ON public.education_content FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_education_content_updated_at
  BEFORE UPDATE ON public.education_content
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
