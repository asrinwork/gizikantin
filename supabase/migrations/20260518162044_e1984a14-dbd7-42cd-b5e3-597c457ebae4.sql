
CREATE OR REPLACE FUNCTION public.any_admin_exists()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin');
$$;
GRANT EXECUTE ON FUNCTION public.any_admin_exists() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.log_audit(_action text, _entity text, _entity_id text, _detail jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _email text;
BEGIN
  SELECT email INTO _email FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.audit_logs(actor_id, actor_email, action, entity, entity_id, detail)
  VALUES (auth.uid(), _email, _action, _entity, _entity_id, _detail);
END $$;
REVOKE EXECUTE ON FUNCTION public.log_audit(text,text,text,jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.log_audit(text,text,text,jsonb) TO authenticated;
