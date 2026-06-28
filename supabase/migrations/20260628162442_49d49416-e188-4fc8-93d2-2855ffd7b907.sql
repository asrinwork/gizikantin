ALTER TABLE public.foods ADD COLUMN IF NOT EXISTS image_url TEXT;

CREATE TABLE IF NOT EXISTS public.student_credentials (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  password TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.student_credentials TO authenticated;
GRANT ALL ON public.student_credentials TO service_role;

ALTER TABLE public.student_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read credentials" ON public.student_credentials
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- food-images bucket policies
CREATE POLICY "Anyone read food images" ON storage.objects
  FOR SELECT USING (bucket_id = 'food-images');

CREATE POLICY "Authenticated upload food images" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'food-images');

CREATE POLICY "Authenticated update food images" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'food-images');

CREATE POLICY "Authenticated delete food images" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'food-images');
