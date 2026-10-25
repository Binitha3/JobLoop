JobLoop

Order-to-delivery workspace for print shops and custom merchandise businesses that quote every job one by one.

Paste a customer's WhatsApp message, review the extracted order, send a quote, and share a tracking link. The AI fills in the form. A person confirms every order.

Live site: https://jobloop-seven.vercel.app

Dashboard

The problem

Small print shops get enquiries on WhatsApp, Instagram, calls and walk-ins. Staff retype the details, work out a price by hand, chase missing information and keep updating customers. JobLoop turns each enquiry into a tracked job with a quote and a status the customer can check.

What it does

Orders and customers

Customer records with phone, email and source channel (WhatsApp, Instagram, call, walk-in)
Orders with line items from a service catalogue, due dates and notes
Status workflow: enquiry, quoted, approved, in progress, ready, delivered, plus cancel and reopen
Transitions are enforced on the server, and every change is logged with who made it and why

Quotes

Discount, GST and delivery charge, with live totals
Branded PDF quote
Ready-to-send WhatsApp message with a one-click wa.me link (no WhatsApp API needed)

Customer tracking page

Public link with an unguessable token, no login
Shows status steps, dates, due date and the quote total
Exposes no internal notes, staff names or other customers' data
The link can be regenerated, which revokes the old one

AI order extraction (human in the loop)

Paste an informal message in English, Hinglish or other Indian languages
The model returns structured JSON, validated with Zod, with a confidence level per field
Review screen shows the original message next to editable fields, with missing and low-confidence fields highlighted
Prices always come from the catalogue, never from the model
Duplicate customers are matched by phone number
Nothing is created until the owner confirms

Artwork preflight

Upload PNG, JPG or WebP artwork to an order item
Automatic checks: effective DPI for the print size, aspect ratio, colour space (RGB or CMYK), bleed, safe zone, sharpness and transparency
Clear pass, warn or fail results with a plain-language fix for each
Orders with failing artwork can't move to production without an override reason, which is logged
Sharpness and safe-zone checks are heuristics and can be wrong on minimal designs
How it works
Customer message
AI extraction
Owner reviews and edits
Order created
Quote and PDF
WhatsApp message withtracking link
Artwork preflight
Production
Customer tracks status
Screens
		
Paste message	Extraction review	New order
Paste a customer message	Review extracted details	Order with line items
Quote	Timeline	Tracking page
Quote totals	Status history	Customer tracking page
Tech stack
Next.js (App Router) and TypeScript
Supabase: PostgreSQL, Auth, Row Level Security, Storage
Zod for validation of all inputs and all AI output
Provider-agnostic LLM wrapper (OpenAI, Anthropic or Google) with retries and an optional fallback model
@react-pdf/renderer for quote PDFs
sharp for artwork analysis
Vitest for unit tests, Playwright for browser checks
Deployed on Vercel
Design decisions
AI never acts on its own. Extraction only fills a review screen, and a person confirms the order.
Business rules live in plain functions. Pricing, quote totals and status transitions are pure, tested functions, and the database enforces the same rules.
Workspace isolation. Every table is scoped by workspace with Row Level Security.
The public tracking page uses a small, fixed set of fields. It is fetched on the server by token, and no table is opened to anonymous users.
The AI layer survives provider outages. It retries temporary errors, can fall back to a second model, and shows plain error messages instead of raw provider output.
Getting started
Requirements
Node.js 20 or later
A Supabase project
An API key for one supported LLM provider (Google's free tier works for testing)
Setup
bash
git clone https://github.com/Binitha3/JobLoop.git
cd JobLoop
npm install
cp .env.example .env.local

Fill in .env.local. See .env.example for the full list. The main variables are:

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=       # server only, never expose to the browser
AI_PROVIDER=                     # openai, anthropic or google
AI_MODEL=
AI_API_KEY=
AI_FALLBACK_MODEL=               # optional

Apply the database migrations, then start the app:

bash
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
npm run dev

Open http://localhost:3000.

Tests
bash
npm test
Project structure
src/            app routes, components and server logic
supabase/       migrations and seed data
scripts/        demo data and screenshot scripts
public/hero/    landing page screenshots
public/demo-artwork/   sample files for the preflight demo
Roadmap
Customer proof approval with pinned comments
Voice note to order (Hindi, Kannada, English)
PDF artwork preflight
Quote suggestions from similar past orders, with margin warnings
Payment tracking and an outstanding balance report
Industry templates, so the same engine works for other businesses that quote each job
Notes

This is a portfolio project. The demo data is made up. Don't enter real customer details on the live site.

Built by Binitha.
