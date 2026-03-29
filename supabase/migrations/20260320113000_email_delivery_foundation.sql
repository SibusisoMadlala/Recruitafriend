-- ============================================================
-- Product email delivery foundation (SMTP workflow logging + metadata)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.email_delivery_logs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type          TEXT NOT NULL,
  event_key           TEXT NOT NULL UNIQUE,
  category            TEXT NOT NULL CHECK (category IN ('alerts', 'referrals', 'employer_communications')),
  recipient_email     TEXT NOT NULL,
  subject             TEXT NOT NULL,
  template_key        TEXT NOT NULL,
  template_vars       JSONB NOT NULL DEFAULT '{}'::jsonb,
  status              TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'suppressed')),
  attempt_count       INT NOT NULL DEFAULT 0,
  last_error          TEXT,
  provider_message_id TEXT,
  sent_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_event_type ON public.email_delivery_logs (event_type);
CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_recipient ON public.email_delivery_logs (recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_status ON public.email_delivery_logs (status);
CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_created_at ON public.email_delivery_logs (created_at DESC);

ALTER TABLE public.email_delivery_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_delivery_logs_select_service" ON public.email_delivery_logs;
CREATE POLICY "email_delivery_logs_select_service"
  ON public.email_delivery_logs FOR SELECT
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "email_delivery_logs_insert_service" ON public.email_delivery_logs;
CREATE POLICY "email_delivery_logs_insert_service"
  ON public.email_delivery_logs FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "email_delivery_logs_update_service" ON public.email_delivery_logs;
CREATE POLICY "email_delivery_logs_update_service"
  ON public.email_delivery_logs FOR UPDATE
  USING (auth.role() = 'service_role');

ALTER TABLE public.job_alerts
  ADD COLUMN IF NOT EXISTS next_dispatch_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_dispatched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_dispatch_status TEXT,
  ADD COLUMN IF NOT EXISTS last_dispatch_error TEXT;

UPDATE public.job_alerts
SET next_dispatch_at = COALESCE(next_dispatch_at, now()),
    last_dispatch_status = COALESCE(last_dispatch_status, 'pending');

ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS invite_email_status TEXT,
  ADD COLUMN IF NOT EXISTS invite_email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invite_email_last_error TEXT,
  ADD COLUMN IF NOT EXISTS invite_email_attempt_count INT NOT NULL DEFAULT 0;

UPDATE public.referrals
SET invite_email_status = COALESCE(invite_email_status, CASE WHEN referee_email IS NULL THEN 'not_sent' ELSE 'pending' END);

CREATE INDEX IF NOT EXISTS idx_job_alerts_next_dispatch_at ON public.job_alerts (next_dispatch_at);
CREATE INDEX IF NOT EXISTS idx_referrals_invite_email_status ON public.referrals (invite_email_status);