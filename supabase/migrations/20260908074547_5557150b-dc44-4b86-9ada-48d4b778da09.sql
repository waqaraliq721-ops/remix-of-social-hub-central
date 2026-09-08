CREATE OR REPLACE FUNCTION public.export_quota()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  t public.app_tier;
  used int := 0;
  lim int;
  per text;
  since timestamptz;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('tier','free','used',0,'limit',0,'period','month',
                              'allowed',false,'watermark',true,'voiceover',false);
  END IF;

  SELECT tier INTO t FROM public.subscriptions WHERE user_id = uid;
  IF t IS NULL THEN
    t := 'free';
  END IF;

  IF t = 'ultimate' THEN
    RETURN jsonb_build_object('tier','ultimate','used',0,'limit',-1,'period','none',
                              'allowed',true,'watermark',false,'voiceover',true);
  ELSIF t = 'basic' THEN
    lim := 3; per := 'week'; since := date_trunc('week', now());
  ELSE
    lim := 5; per := 'month'; since := date_trunc('month', now());
  END IF;

  SELECT count(*) INTO used FROM public.export_events
   WHERE user_id = uid AND created_at >= since;

  RETURN jsonb_build_object(
    'tier', t,
    'used', used,
    'limit', lim,
    'period', per,
    'allowed', used < lim,
    'watermark', t = 'free',
    'voiceover', t <> 'free'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.export_quota() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.export_quota() TO authenticated, service_role;