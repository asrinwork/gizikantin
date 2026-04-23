
-- Roles enum & user_roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'guru', 'kantin');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role security definer
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- Get current user roles helper
CREATE OR REPLACE FUNCTION public.get_my_roles()
RETURNS SETOF public.app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid();
$$;

-- Trigger: auto create profile + default role 'guru' on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  -- First user becomes admin, others default to guru
  IF (SELECT COUNT(*) FROM auth.users) = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'guru'));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Profiles policies
CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Admins manage profiles" ON public.profiles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- user_roles policies
CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Students
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nis TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  class_name TEXT NOT NULL,
  gender TEXT CHECK (gender IN ('L','P')),
  birth_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read students" ON public.students
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage students" ON public.students
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Foods
CREATE TABLE public.foods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  calories NUMERIC NOT NULL DEFAULT 0,
  protein NUMERIC NOT NULL DEFAULT 0,
  carbs NUMERIC NOT NULL DEFAULT 0,
  fat NUMERIC NOT NULL DEFAULT 0,
  sugar NUMERIC NOT NULL DEFAULT 0,
  price NUMERIC NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.foods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read foods" ON public.foods
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Kantin/Admin manage foods" ON public.foods
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'kantin') OR public.has_role(auth.uid(), 'admin'));

-- Transactions
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  food_id UUID NOT NULL REFERENCES public.foods(id) ON DELETE RESTRICT,
  quantity NUMERIC NOT NULL DEFAULT 1 CHECK (quantity > 0),
  recorded_by UUID REFERENCES auth.users(id),
  consumed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_tx_student_date ON public.transactions(student_id, consumed_at);
CREATE POLICY "Authenticated read transactions" ON public.transactions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Kantin/Admin insert transactions" ON public.transactions
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'kantin') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Kantin/Admin update transactions" ON public.transactions
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'kantin') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Kantin/Admin delete transactions" ON public.transactions
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'kantin') OR public.has_role(auth.uid(), 'admin'));

-- Nutrition targets (single school, single row but allow versioning)
CREATE TABLE public.nutrition_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL DEFAULT 'Default',
  calories NUMERIC NOT NULL DEFAULT 2000,
  protein NUMERIC NOT NULL DEFAULT 50,
  carbs NUMERIC NOT NULL DEFAULT 275,
  fat NUMERIC NOT NULL DEFAULT 65,
  sugar NUMERIC NOT NULL DEFAULT 50,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.nutrition_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read targets" ON public.nutrition_targets
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage targets" ON public.nutrition_targets
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.nutrition_targets (label, calories, protein, carbs, fat, sugar)
VALUES ('Default AKG SD (7-12 thn)', 2000, 50, 275, 65, 50);
