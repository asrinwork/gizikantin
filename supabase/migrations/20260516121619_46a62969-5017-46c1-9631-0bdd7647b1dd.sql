
-- =========================
-- CLASSES
-- =========================
CREATE TABLE IF NOT EXISTS public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  grade_level INT,
  homeroom_teacher_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read classes" ON public.classes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage classes" ON public.classes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =========================
-- EXTEND students with profile fields + auth link
-- =========================
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS height_cm NUMERIC,
  ADD COLUMN IF NOT EXISTS weight_kg NUMERIC,
  ADD COLUMN IF NOT EXISTS activity_level TEXT NOT NULL DEFAULT 'light'
    CHECK (activity_level IN ('sedentary','light','moderate','active','very_active'));

-- Allow students to read own row, guru/kantin to read all
DROP POLICY IF EXISTS "Authenticated read students" ON public.students;
CREATE POLICY "Read students" ON public.students FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'guru')
  OR public.has_role(auth.uid(),'kantin')
  OR user_id = auth.uid()
);

-- Allow students to update own profile (height/weight only — enforced via column grants would be ideal but trigger validates)
CREATE POLICY "Student update own profile" ON public.students FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- =========================
-- DAILY NUTRITION TARGETS (cache)
-- =========================
CREATE TABLE IF NOT EXISTS public.daily_nutrition_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  calories NUMERIC NOT NULL,
  protein NUMERIC NOT NULL,
  carbs NUMERIC NOT NULL,
  fat NUMERIC NOT NULL,
  sugar NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, date)
);
ALTER TABLE public.daily_nutrition_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read daily targets" ON public.daily_nutrition_targets FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'guru') OR public.has_role(auth.uid(),'kantin')
  OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid())
);
CREATE POLICY "Insert daily targets" ON public.daily_nutrition_targets FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(),'admin')
  OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid())
);

-- =========================
-- ORDERS
-- =========================
DO $$ BEGIN
  CREATE TYPE public.order_status AS ENUM ('pending','ready','completed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  status public.order_status NOT NULL DEFAULT 'pending',
  total_calories NUMERIC NOT NULL DEFAULT 0,
  total_price NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_orders_student_date ON public.orders(student_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);

CREATE POLICY "Read orders" ON public.orders FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'kantin') OR public.has_role(auth.uid(),'guru')
  OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid())
);
CREATE POLICY "Student create own order" ON public.orders FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid())
);
CREATE POLICY "Student cancel own pending" ON public.orders FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid())
  AND status = 'pending'
) WITH CHECK (status IN ('pending','cancelled'));
CREATE POLICY "Kantin/Admin manage orders" ON public.orders FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(),'kantin') OR public.has_role(auth.uid(),'admin')
) WITH CHECK (true);
CREATE POLICY "Admin delete orders" ON public.orders FOR DELETE TO authenticated USING (
  public.has_role(auth.uid(),'admin')
);

-- =========================
-- ORDER ITEMS
-- =========================
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  food_id UUID NOT NULL REFERENCES public.foods(id) ON DELETE RESTRICT,
  quantity NUMERIC NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_calories NUMERIC NOT NULL DEFAULT 0,
  unit_price NUMERIC NOT NULL DEFAULT 0
);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);

CREATE POLICY "Read order items" ON public.order_items FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'kantin') OR public.has_role(auth.uid(),'guru')
  OR EXISTS (
    SELECT 1 FROM public.orders o JOIN public.students s ON s.id = o.student_id
    WHERE o.id = order_id AND s.user_id = auth.uid()
  )
);
CREATE POLICY "Insert order items via own order" ON public.order_items FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'kantin')
  OR EXISTS (
    SELECT 1 FROM public.orders o JOIN public.students s ON s.id = o.student_id
    WHERE o.id = order_id AND s.user_id = auth.uid()
  )
);
CREATE POLICY "Admin/Kantin manage order items" ON public.order_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'kantin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'kantin'));

-- =========================
-- HELPER FUNCTIONS
-- =========================

-- Mifflin-St Jeor BMR + activity factor
CREATE OR REPLACE FUNCTION public.calc_daily_calories(_student_id UUID)
RETURNS NUMERIC LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s RECORD;
  age_yr NUMERIC;
  bmr NUMERIC;
  factor NUMERIC;
BEGIN
  SELECT gender, birth_date, height_cm, weight_kg, activity_level
    INTO s FROM public.students WHERE id = _student_id;
  IF s IS NULL OR s.height_cm IS NULL OR s.weight_kg IS NULL OR s.birth_date IS NULL THEN
    -- fallback to active default target
    RETURN (SELECT calories FROM public.nutrition_targets WHERE is_active LIMIT 1);
  END IF;
  age_yr := GREATEST(5, EXTRACT(YEAR FROM age(s.birth_date)));
  IF COALESCE(s.gender,'L') = 'L' THEN
    bmr := 10 * s.weight_kg + 6.25 * s.height_cm - 5 * age_yr + 5;
  ELSE
    bmr := 10 * s.weight_kg + 6.25 * s.height_cm - 5 * age_yr - 161;
  END IF;
  factor := CASE COALESCE(s.activity_level,'light')
    WHEN 'sedentary' THEN 1.2 WHEN 'light' THEN 1.375
    WHEN 'moderate' THEN 1.55 WHEN 'active' THEN 1.725
    WHEN 'very_active' THEN 1.9 ELSE 1.375 END;
  RETURN ROUND(bmr * factor);
END $$;

-- Sum kalori hari ini (transactions + pending/ready orders)
CREATE OR REPLACE FUNCTION public.today_calories(_student_id UUID)
RETURNS NUMERIC LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((
    SELECT SUM(t.quantity * f.calories) FROM public.transactions t
    JOIN public.foods f ON f.id = t.food_id
    WHERE t.student_id = _student_id AND t.consumed_at::date = CURRENT_DATE
  ),0)
  + COALESCE((
    SELECT SUM(o.total_calories) FROM public.orders o
    WHERE o.student_id = _student_id AND o.created_at::date = CURRENT_DATE
      AND o.status IN ('pending','ready')
  ),0);
$$;

-- Trigger: validate order calorie restriction
CREATE OR REPLACE FUNCTION public.enforce_calorie_limit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target NUMERIC;
  already NUMERIC;
BEGIN
  -- admin/kantin override allowed
  IF public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'kantin') THEN
    RETURN NEW;
  END IF;
  target := public.calc_daily_calories(NEW.student_id);
  already := public.today_calories(NEW.student_id);
  IF (already + COALESCE(NEW.total_calories,0)) > target THEN
    RAISE EXCEPTION 'Pesanan melebihi kebutuhan kalori harian (target: % kkal, sudah: % kkal, pesanan: % kkal)',
      target, already, NEW.total_calories
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_calorie ON public.orders;
CREATE TRIGGER trg_enforce_calorie
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_calorie_limit();

-- Trigger: when order becomes completed, generate transactions
CREATE OR REPLACE FUNCTION public.order_complete_to_transactions()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed' AND COALESCE(OLD.status,'') <> 'completed' THEN
    INSERT INTO public.transactions (student_id, food_id, quantity, recorded_by, consumed_at)
    SELECT NEW.student_id, oi.food_id, oi.quantity, NEW.verified_by, COALESCE(NEW.verified_at, now())
    FROM public.order_items oi WHERE oi.order_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_order_complete ON public.orders;
CREATE TRIGGER trg_order_complete
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.order_complete_to_transactions();
