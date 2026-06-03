
-- BMR formulas (Schofield W defaults)
CREATE TABLE public.bmr_formulas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  gender text NOT NULL CHECK (gender IN ('L','P')),
  age_min int NOT NULL,
  age_max int NOT NULL,
  coef_weight numeric NOT NULL DEFAULT 0,
  coef_height numeric NOT NULL DEFAULT 0,
  constant numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bmr_formulas TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bmr_formulas TO authenticated;
GRANT ALL ON public.bmr_formulas TO service_role;
ALTER TABLE public.bmr_formulas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bmr read all" ON public.bmr_formulas FOR SELECT USING (true);
CREATE POLICY "bmr admin insert" ON public.bmr_formulas FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "bmr admin update" ON public.bmr_formulas FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "bmr admin delete" ON public.bmr_formulas FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Activity factors
CREATE TABLE public.activity_factors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  factor numeric NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.activity_factors TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_factors TO authenticated;
GRANT ALL ON public.activity_factors TO service_role;
ALTER TABLE public.activity_factors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "af read all" ON public.activity_factors FOR SELECT USING (true);
CREATE POLICY "af admin insert" ON public.activity_factors FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "af admin update" ON public.activity_factors FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "af admin delete" ON public.activity_factors FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Seed Schofield W defaults
INSERT INTO public.bmr_formulas (label, gender, age_min, age_max, coef_weight, coef_height, constant) VALUES
('Laki-laki 0-3 thn','L',0,2,0.167,15.174,-617.6),
('Laki-laki 3-10 thn','L',3,9,19.59,1.303,414.9),
('Laki-laki 10-18 thn','L',10,18,16.25,1.372,515.5),
('Perempuan 0-3 thn','P',0,2,16.252,10.232,-413.5),
('Perempuan 3-10 thn','P',3,9,16.969,1.618,371.2),
('Perempuan 10-18 thn','P',10,18,8.365,4.65,200);

INSERT INTO public.activity_factors (key,label,factor,sort_order) VALUES
('sedentary','Sangat ringan',1.2,1),
('light','Ringan',1.375,2),
('moderate','Sedang',1.55,3),
('active','Sangat aktif',1.725,4),
('very_active','Aktivitas berat (Extremely active)',1.9,5);

-- Replace calc_daily_calories to use Schofield via tables
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
  factor NUMERIC;
BEGIN
  SELECT gender, birth_date, height_cm, weight_kg, activity_level
    INTO s FROM public.students WHERE id = _student_id;
  IF s IS NULL OR s.height_cm IS NULL OR s.weight_kg IS NULL OR s.birth_date IS NULL THEN
    RETURN (SELECT calories FROM public.nutrition_targets WHERE is_active LIMIT 1);
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
    RETURN (SELECT calories FROM public.nutrition_targets WHERE is_active LIMIT 1);
  END IF;
  bmr := f.coef_weight * s.weight_kg + f.coef_height * s.height_cm + f.constant;
  SELECT factor INTO factor FROM public.activity_factors
    WHERE key = COALESCE(s.activity_level,'light') LIMIT 1;
  IF factor IS NULL THEN factor := 1.375; END IF;
  RETURN ROUND(bmr * factor);
END $function$;
