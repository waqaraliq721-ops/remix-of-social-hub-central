CREATE TYPE public.app_tier AS ENUM ('free','basic','ultimate');

CREATE TABLE public.subscriptions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  tier public.app_tier NOT NULL DEFAULT 'free',
  tier_changed_at timestamptz NOT NULL DEFAULT now(),
  notified_tier public.app_tier,
  welcome_email_sent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own subscription read" ON public.subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_subscriptions_updated BEFORE UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.export_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'video',
  watermarked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.export_events TO authenticated;
GRANT ALL ON public.export_events TO service_role;
ALTER TABLE public.export_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own export events read" ON public.export_events FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE INDEX export_events_user_created_idx ON public.export_events (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.export_quota(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tier public.app_tier;
  _week int;
  _month int;
  _total int;
  _limit int;
  _used int;
  _period text;
BEGIN
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
    'tier', _tier,
    'limit', _limit,
    'used', _used,
    'period', _period,
    'weekUsed', _week,
    'monthUsed', _month,
    'totalUsed', _total,
    'allowed', (_limit IS NULL OR _used < _limit),
    'watermark', (_tier = 'free'),
    'voiceover', (_tier <> 'free')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.export_quota(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.handle_new_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_subscription
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_subscription();

INSERT INTO public.subscriptions (user_id, email)
SELECT id, email FROM auth.users
ON CONFLICT (user_id) DO NOTHING;