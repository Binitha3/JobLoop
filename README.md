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

3. Copy `.env.example` to `.env.local`. Set
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the local publishable key from
   `supabase status` (or use the legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` name),
   and keep the URL at
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

## Artwork upload and preflight

Each order line can include an optional print width and height, a unit
(`mm`, `cm`, `in`, or `ft`), and bleed (3 mm by default). On the order detail
page, upload PNG, JPG, or WebP artwork up to 25 MB. The browser uploads directly
to the private `artwork` Storage bucket using a signed upload URL; the server
checks the image signature, records the file, and runs preflight automatically.
PDF is not supported yet and is labelled “PDF preflight coming later.”

The report checks effective DPI, aspect ratio, colour space, bleed, safe zone,
sharpness, transparency, and file size. AI notes are optional suggestions and
never affect the report status. When `AI_PROVIDER`, `AI_MODEL`, and
`AI_API_KEY` are configured for a vision-capable model, a downscaled image is
reviewed for possible tiny text, low contrast, watermarks, and pixelation.
Starting production is blocked when an artwork report fails; an authorized
user can override the block by confirming and providing a reason, which is
saved in order history.

Apply the latest Supabase migration (`supabase db reset` locally or
`supabase db push` for a linked hosted project) before testing upload. To
regenerate the committed demo images and run the image-engine tests:

```powershell
npm run fixtures:artwork
npm test -- src/lib/preflight
```

## Landing hero screenshots

After changing workspace UI shown in the landing hero, rerun the capture script
against the seeded demo workspace. Set `DEMO_PASSWORD` to the password of
`demo@jobloop.local`; optionally set `JOBLOOP_URL` if the dev server is not at
`http://127.0.0.1:3000`.

```powershell
$env:DEMO_PASSWORD = "your-demo-password"
npx playwright install chromium
npx tsx scripts/capture-hero-shots.ts
```

The script requires the seeded demo workspace and a locally installed Playwright
Chromium browser. It updates the ten WebP screenshots in `public/hero/`.

## Use a hosted Supabase project

1. Create a Supabase project and copy its Project URL and publishable key into
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

Only the public publishable/anon key belongs in this frontend configuration. Never expose
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

The login/signup flow, owner workspace provisioning, tenant-isolated database,
private order and artwork buckets, customer management, order creation and
status history, artwork preflight, quote generation, AI extraction, and public
tracking UI are implemented.
