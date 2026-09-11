-- Real social-media OAuth connections for Orbit.
-- Apply this migration to the Supabase project used by the app.

alter table public.social_accounts
  add column if not exists provider_account_id text,
  add column if not exists access_token_encrypted text,
  add column if not exists refresh_token_encrypted text,
  add column if not exists token_expires_at timestamptz,
  add column if not exists avatar_url text,
  add column if not exists scopes text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists social_accounts_user_platform_provider_uidx
  on public.social_accounts(user_id, platform, provider_account_id)
  where provider_account_id is not null;

create index if not exists social_accounts_user_platform_idx
  on public.social_accounts(user_id, platform);
