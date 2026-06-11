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
cd quotebook
export SUPABASE_DB_PASSWORD='your-db-password'
supabase db push
```

Or run the SQL files in `supabase/migrations/` from the Supabase SQL editor **in filename order**.

3. **Configure environment**

```bash
cd frontend
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

## Production deploy

### 1. Database

Apply every migration in `supabase/migrations/` to your remote project:

```bash
supabase link --project-ref your-project-ref
export SUPABASE_DB_PASSWORD='your-db-password'
supabase db push
```

### 2. Vercel (frontend)

1. Import the repo at [vercel.com](https://vercel.com)
2. Set **Root Directory** to `frontend`
3. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy

### 3. Supabase auth URLs

In **Authentication → URL Configuration**:

| Field | Value |
|-------|-------|
| Site URL | `https://your-app.vercel.app` |
| Redirect URLs | `https://your-app.vercel.app/**` |
| | `http://localhost:5173/reset-password` (local dev) |
| | `https://your-app.vercel.app/reset-password` |

## Project structure

```
frontend/                 React app (Vite)
supabase/
  migrations/             Database schema, RLS policies, RPC functions
```

## Features

- Multi-line dialogue logging with fuzzy dates
- Quotebooks with sharing (viewer / contributor / admin roles)
- Contributors can edit any quote in a shared quotebook
- Admins can manage collaborators
- Global search, read-mode export, book view
- Supabase Auth + RLS for security
