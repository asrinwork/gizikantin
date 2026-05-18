
-- 1) Add new roles to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'wali_kelas';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'kepala_sekolah';
