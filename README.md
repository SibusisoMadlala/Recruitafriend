
  # Create from File Data

  This is a code bundle for Create from File Data. The original project is available at https://www.figma.com/design/WM1yiH4cQPIujS0k4767hg/Create-from-File-Data.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

  ## Product email SMTP prerequisites

  Product workflow email dispatch (alerts, referrals, employer communications) is handled in `supabase/functions/server/index.tsx` and requires SMTP settings in the edge-function environment.

  Required settings:

  - `SMTP_HOST`
  - `SMTP_PORT`
  - `SMTP_USERNAME`
  - `SMTP_PASSWORD`
  - `SMTP_FROM_EMAIL`

  Optional settings:

  - `SMTP_SECURE` (default: `true`)
  - `SMTP_MAX_ATTEMPTS` (default: `3`, bounded to 1-5)
  - `SMTP_FROM_NAME` (global fallback sender name)
  - `SMTP_FROM_NAME_AUTH`
  - `SMTP_FROM_NAME_ALERTS`
  - `SMTP_FROM_NAME_REFERRALS`
  - `SMTP_FROM_NAME_EMPLOYER`

  Sender identity policy:

  - Auth emails use `SMTP_FROM_NAME_AUTH` (fallback: `Recruitfriend Admin`)
  - Alerts use `SMTP_FROM_NAME_ALERTS` (fallback: `RecruitFriend Alerts`)
  - Referrals use `SMTP_FROM_NAME_REFERRALS` (fallback: `RecruitFriend Referrals`)
  - Employer communications use `SMTP_FROM_NAME_EMPLOYER` (fallback: `RecruitFriend Hiring`)

  Configuration notes:

  - For deployed edge functions, set `SMTP_*` values in Supabase-managed secrets rather than the frontend `.env` file.
  - When using Gmail SMTP, set `SMTP_USERNAME` to the full mailbox address (for example `admin@recruitfriend.co.za`) and use an app password.

  Deliverability requirements for production:

  - Configure SPF for your sending domain
  - Configure DKIM for your sending domain
  - Configure a DMARC policy for your sending domain
  