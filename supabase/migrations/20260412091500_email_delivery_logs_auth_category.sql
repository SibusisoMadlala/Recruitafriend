-- Allow auth-related transactional emails to be logged alongside existing product email categories.

ALTER TABLE public.email_delivery_logs
  DROP CONSTRAINT IF EXISTS email_delivery_logs_category_check;

ALTER TABLE public.email_delivery_logs
  ADD CONSTRAINT email_delivery_logs_category_check
  CHECK (category IN ('alerts', 'referrals', 'employer_communications', 'auth'));