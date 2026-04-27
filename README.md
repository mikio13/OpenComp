# OpenComp

OpenComp is a competitor research workbench with Supabase email/password
authentication. Users enter competitor websites and a research prompt, then the
app streams a TinyFish mystery-shopping run for each checkout funnel.

## Frontend Structure

- `app/page.tsx` renders the research workbench through `features/landing` and
  `features/research`.
- `app/auth/login/page.tsx` renders the login flow through `features/auth`.
- `app/auth/sign-up/page.tsx` renders the signup flow through `features/auth`.
- `features/auth/components/auth-button.tsx` shows login/signup links or the
  current user with logout.
- `app/api/research/stream/route.ts` proxies TinyFish SSE events and returns
  competitor observations, Stripe-ready pricing actions, and a review-first
  Codex/Stripe API handoff.

## Local Development

Create `.env.local` with your Supabase project values:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-or-anon-key
TINYFISH_API_KEY=your-tinyfish-api-key
```

Run the app:

```bash
npm run dev
```
