# ePromos Order Entry Tracker — Setup Guide

## Stack
- **Next.js 14** (App Router, TypeScript)
- **Supabase** (PostgreSQL database)
- **Tailwind CSS**
- **Vercel** (hosting)

---

## Step 1 — Create the GitHub Repository

1. Go to [github.com/new](https://github.com/new)
2. Name it `epromos-tracker` (or your preferred name)
3. Set to **Private**
4. Do NOT initialize with a README (we have our own files)
5. Click **Create repository**

Then in your terminal (from the folder containing `epromos-tracker/`):

```bash
cd epromos-tracker
git init
git add .
git commit -m "Initial commit: ePromos Order Entry Tracker"
git remote add origin https://github.com/YOUR_USERNAME/epromos-tracker.git
git branch -M main
git push -u origin main
```

---

## Step 2 — Install Dependencies Locally

```bash
cd epromos-tracker
npm install
```

---

## Step 3 — Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and sign in / create an account
2. Click **New Project**, choose a name (e.g. `epromos-tracker`) and set a database password
3. Wait for the project to spin up (~1 min)

### Run the Schema

4. In your Supabase project, go to **SQL Editor** (left sidebar)
5. Click **New Query**
6. Open the file `supabase-schema.sql` from this project and paste the entire contents
7. Click **Run** — you should see "Success"

### Get Your API Keys

8. Go to **Project Settings → API**
9. Copy:
   - **Project URL** → this is your `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → this is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## Step 4 — Configure Environment Variables Locally

Create a `.env.local` file in the project root:

```bash
cp .env.local.example .env.local
```

Then edit `.env.local` and fill in your values:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_ENTRY_LOG_PASSWORD=your_entry_log_password
NEXT_PUBLIC_EMPLOYEES_PASSWORD=your_employees_admin_password
```

> **Note:** Passwords prefixed with `NEXT_PUBLIC_` are visible in browser bundles.
> This is acceptable for a simple internal tool. For stronger security, move
> password verification to a server-side API route later.

---

## Step 5 — Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you should see the Process Tracker.

Test the three sections:
- `/` → Process Tracker (timer + form)
- `/entry-log` → Password-protected entry log
- `/employees` → Password-protected employee roster

---

## Step 6 — Deploy to Vercel

### Option A: Via Vercel Dashboard (Recommended)

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **Add New → Project**
3. Select your `epromos-tracker` repository
4. Vercel will auto-detect Next.js — keep all defaults
5. Before clicking Deploy, go to **Environment Variables** and add:

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your Supabase anon key |
| `NEXT_PUBLIC_ENTRY_LOG_PASSWORD` | your entry log password |
| `NEXT_PUBLIC_EMPLOYEES_PASSWORD` | your admin password |

6. Click **Deploy** — done! Vercel gives you a URL like `epromos-tracker.vercel.app`

### Option B: Via Vercel CLI

```bash
npm i -g vercel
vercel
# Follow the prompts, then set env vars:
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add NEXT_PUBLIC_ENTRY_LOG_PASSWORD
vercel env add NEXT_PUBLIC_EMPLOYEES_PASSWORD
vercel --prod
```

---

## Future Improvements

- **Add Supabase Auth** to replace the simple front-end password check with real login
- **CSV Export** button on the Entry Log page
- **Charts/Analytics** page showing time by task/role/department
- **Custom domain** in Vercel settings

---

## Project Structure

```
epromos-tracker/
├── app/
│   ├── layout.tsx              # Root layout + nav header
│   ├── page.tsx                # Process Tracker (timer + form)
│   ├── entry-log/
│   │   └── page.tsx            # Password-protected entry log
│   ├── employees/
│   │   └── page.tsx            # Password-protected employee roster
│   └── api/
│       ├── entries/
│       │   ├── route.ts        # GET all / POST new entry
│       │   └── [id]/route.ts   # DELETE entry by id
│       └── employees/
│           ├── route.ts        # GET all / POST new employee
│           └── [id]/route.ts   # PATCH / DELETE employee by id
├── lib/
│   ├── supabase.ts             # Supabase client + TypeScript types
│   └── taskData.ts             # Full task hierarchy from ePromos Time Study
├── supabase-schema.sql         # Copy-paste into Supabase SQL Editor
├── .env.local.example          # Template for environment variables
└── SETUP.md                    # This file
```
