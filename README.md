# JobLoop

JobLoop is an order-to-delivery workspace for print shops and custom
merchandise businesses. Phase 1 establishes the Next.js app, Supabase
authentication, tenant-isolated database schema, and print-shop demo data.

## Requirements

- Node.js 20.9 or newer
- npm
- A Supabase project (local Supabase requires Docker and the Supabase CLI)

## Run locally with Supabase

1. Install the Supabase CLI using the [official installation guide](https://supabase.com/docs/guides/cli).
2. Start the local Supabase services and apply the migration and seed:

   ```powershell
   supabase start
   supabase db reset
   ```

   `supabase db reset` applies the files in `supabase/migrations/` and runs
   `supabase/seed.sql`. The Studio URL and local API keys are printed by
   `supabase start`.

3. Copy `.env.example` to `.env.local`. Set `NEXT_PUBLIC_SUPABASE_ANON_KEY` to
   the local anon key from `supabase status` (and keep the URL at
   `http://127.0.0.1:54321`).
4. Install dependencies and run the web app:

   ```powershell
   npm install
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) and create an account.
   The database trigger provisions the owner workspace at signup.

To load the demo orders into the account's workspace, register with
`demo@jobloop.local`, then run `supabase/seed.sql` again in the local Supabase
Studio SQL editor. The seed is repeatable and connects the demo workspace to
that account. Demo email addresses use the reserved `example.com` domain and
the names and phone numbers are synthetic.

## Use a hosted Supabase project

1. Create a Supabase project and copy its Project URL and anon/public key into
   `.env.local` (use `.env.example` as the template).
2. Link the Supabase CLI and apply the schema:

   ```powershell
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase db push
   ```

3. Run `supabase/seed.sql` in the project's SQL editor if you want the demo
   catalogue and orders.
4. Start JobLoop with `npm run dev`.

Only the public anon key belongs in this frontend configuration. Never expose
the Supabase service-role key in a `NEXT_PUBLIC_` variable or commit it.

## Phase 1 structure

```text
src/
  app/                  App Router pages and layouts
  components/           Auth and reusable UI
  lib/
    supabase/           Browser, server, and proxy clients
    validators/         Zod schemas
  server/actions/       Validated server actions
supabase/
  migrations/           PostgreSQL schema, RLS, auth trigger, storage policies
  seed.sql              Print-shop catalogue and 25 customers / 40 orders
```

The initial migration creates workspace membership, customers, configurable
services and options, orders and line items, quotes, payments, audit events,
attachments, and tracking tokens. Every tenant-owned table has RLS policies
based on the signed-in user's workspace membership. The public tracking
function returns only customer-safe order fields; it does not expose internal
notes or other workspace records.

## Checks

```powershell
npm run lint
npx tsc --noEmit
npm run build
```

## Current scope

The login/signup flow, owner workspace provisioning, database schema, RLS,
private order-file bucket, and seeded print-shop data are Phase 1. Customer and
order management, quote generation, AI extraction, public tracking UI, and
dashboard workflows are implemented in the following phases.
