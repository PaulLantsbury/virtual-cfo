-- Proposed correction only; not registered with a migration runner or applied live.
-- Separate monthly contribution from cash/other impacts without replaying seed data.
-- Preserve the observed signature, volatility, security mode and search path.
-- Existing SECURITY DEFINER access still requires the separate authorisation review.
BEGIN;
DO $precondition$
BEGIN
  IF to_regprocedure('public.recoverable_contribution_range(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Expected existing recoverable_contribution_range(uuid); reconcile baseline first';
  END IF;
  IF NOT (SELECT prosecdef FROM pg_proc WHERE oid='public.recoverable_contribution_range(uuid)'::regprocedure) THEN
    RAISE EXCEPTION 'Security mode changed; do not overwrite subsequent store-access hardening';
  END IF;
END;
$precondition$;

CREATE OR REPLACE FUNCTION public.recoverable_contribution_range(p_store_id uuid)
 RETURNS TABLE(recoverable_low numeric, recoverable_high numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT
    COALESCE(SUM(impact_low),  0) AS recoverable_low,
    COALESCE(SUM(impact_high), 0) AS recoverable_high
  FROM public.opportunities
  WHERE store_id = p_store_id
    AND status <> 'archived'
    AND impact_type = 'monthly_contribution';
$function$;
COMMIT;
