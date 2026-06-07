# Quotebook

A full-stack web app for logging, organizing, and sharing multi-speaker quotes with fuzzy-dated timelines.

## Stack

- **Frontend:** React + Vite
- **Backend:** Supabase (Auth, Postgres, Row Level Security)
- **Deploy:** Vercel (frontend)

The React app talks directly to Supabase — no Python server required.

## Local setup

1. **Clone and install frontend deps**

```bash
git clone https://github.com/yourusername/quotebook.git
cd quotebook/frontend
npm install
```

2. **Apply Supabase migrations**

If you use the Supabase CLI and have linked your project:

```bash
supabase db push
```

Or run the SQL in `supabase/migrations/` from the Supabase SQL editor (in order).

3. **Configure environment**

Copy the example env file and add your project keys from **Supabase → Project Settings → API**:

```bash
cp .env.example .env
```

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

4. **Run the dev server**

```bash
npm run dev
```

Open http://localhost:5173, sign up, and start adding quotes.

## Supabase auth note

If email confirmation is enabled in Supabase, new users must confirm their email before logging in. For local dev you can disable it under **Authentication → Providers → Email**.

## Project structure

```
frontend/          React app (Vite)
supabase/
  migrations/      Database schema, RLS policies, RPC functions
```

## Features

- Multi-line dialogue logging
- Quotebooks with sharing (viewer / contributor / admin roles)
- Supabase Auth + RLS for security
- Postgres RPCs for multi-utterance inserts and share-by-email
