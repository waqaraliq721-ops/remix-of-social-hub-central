DROP FUNCTION IF EXISTS public.export_quota(uuid);

CREATE OR REPLACE FUNCTION public.export_quota()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _tier public.app_tier;
  _week int;
  _month int;
  _total int;
  _limit int;
  _used int;
  _period text;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT tier INTO _tier FROM public.subscriptions WHERE user_id = _user_id;
  IF _tier IS NULL THEN _tier := 'free'; END IF;

  SELECT count(*) INTO _week FROM public.export_events
    WHERE user_id = _user_id AND created_at >= date_trunc('week', now());
  SELECT count(*) INTO _month FROM public.export_events
    WHERE user_id = _user_id AND created_at >= date_trunc('month', now());
  SELECT count(*) INTO _total FROM public.export_events WHERE user_id = _user_id;

  IF _tier = 'free' THEN
    _limit := 5; _used := _month; _period := 'month';
  ELSIF _tier = 'basic' THEN
    _limit := 3; _used := _week; _period := 'week';
  ELSE
    _limit := NULL; _used := _month; _period := 'unlimited';
  END IF;

  RETURN jsonb_build_object(
    'tier', _tier, 'limit', _limit, 'used', _used, 'period', _period,
    'weekUsed', _week, 'monthUsed', _month, 'totalUsed', _total,
    'allowed', (_limit IS NULL OR _used < _limit),
    'watermark', (_tier = 'free'),
    'voiceover', (_tier <> 'free')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.export_quota() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.export_quota() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.handle_new_subscription() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;