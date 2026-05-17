CREATE OR REPLACE FUNCTION public.order_complete_to_transactions()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'completed'::order_status AND OLD.status IS DISTINCT FROM 'completed'::order_status THEN
    INSERT INTO public.transactions (student_id, food_id, quantity, recorded_by, consumed_at)
    SELECT NEW.student_id, oi.food_id, oi.quantity, NEW.verified_by, COALESCE(NEW.verified_at, now())
    FROM public.order_items oi WHERE oi.order_id = NEW.id;
  END IF;
  RETURN NEW;
END $function$;