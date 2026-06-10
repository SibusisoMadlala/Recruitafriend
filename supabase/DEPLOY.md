# Deploying Subscription Backend

## 1. Run the migration

Open the Supabase dashboard → SQL Editor → paste and run:

```
supabase/migrations/20260610_employer_subscriptions.sql
```

This creates three tables:
- `subscription_plans` — plan catalogue (pre-seeded with Starter/Growth/Professional/Enterprise)
- `employer_subscriptions` — one row per employer, tracks current plan and status
- `subscription_events` — full audit log of every plan change

## 2. Deploy the edge function

```bash
supabase functions deploy make-server-bca21fd3 --project-ref cymjloyfvckczmluqqct
```

## 3. Set the required secret

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<your_service_role_key> \
  --project-ref cymjloyfvckczmluqqct
```

Get the service role key from: Supabase dashboard → Project Settings → API → service_role key.

---

## API routes added

| Method | Route | What it does |
|--------|-------|-------------|
| POST | `/subscriptions/trial` | Starts 14-day Growth trial for the logged-in employer |
| POST | `/subscriptions/change` | Changes plan — body: `{"plan":"GROWTH","billing_cycle":"monthly"}` |
| GET  | `/subscriptions/current` | Returns current plan, status, and limits |

## Adding payments later

When you're ready to add PayFast or another provider:
1. Add a `payment_ref` column update in `handleChangePlan` after verifying the payment webhook
2. Set `status = 'active'` only after payment confirmation
3. Add a new `/subscriptions/webhook` route in `index.ts` to handle provider callbacks
