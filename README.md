# StockFlow — Inventory Management System

A modern, production-ready inventory management SaaS built with Next.js 15, Supabase, and Tailwind CSS.

## Features

- **Dashboard** — Stats cards, sales trend chart, channel distribution, recent activity
- **Products** — Add/edit/delete/search products with pagination
- **Purchases** — Create purchases, auto-creates batches and inventory transactions
- **Sales** — Multi-channel sales entry with batch selection and stock deduction
- **Inventory** — Batch-level stock view with filters
- **Expiry** — Expired, 30/60/90-day near-expiry tracking
- **Timeline** — Full audit trail with date/product/type filters
- **Reports** — Charts + PDF export (jsPDF)
- **Settings** — Profile, password change, theme switcher
- **Dark Mode** — Full dark/light mode support

## Tech Stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- Supabase (Auth + PostgreSQL)
- React Hook Form + Zod
- Recharts
- jsPDF + jspdf-autotable

## Setup Instructions

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) → New Project
2. Copy your **Project URL** and **Anon Key** from Settings → API

### 2. Run the Database Schema

1. In Supabase → SQL Editor → New Query
2. Paste the contents of `supabase-schema.sql`
3. Click **Run**

### 3. Create Auth User

1. In Supabase → Authentication → Users → Invite user
2. Or use the Supabase dashboard to create a user manually
3. Email: `admin@demo.com` / Password: `password123`

### 4. Setup Environment Variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 5. Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deployment (Vercel)

```bash
npm i -g vercel
vercel
```

Add environment variables in Vercel dashboard under Settings → Environment Variables.

## Project Structure

```
src/
├── app/
│   ├── auth/login/        # Login page
│   ├── dashboard/         # Dashboard with charts
│   ├── products/          # Product CRUD
│   ├── purchases/         # Purchase entry
│   ├── sales/             # Sales entry
│   ├── inventory/         # Batch inventory view
│   ├── expiry/            # Expiry management
│   ├── timeline/          # Audit trail
│   ├── reports/           # Charts + PDF export
│   └── settings/          # Profile & settings
├── components/
│   └── layout/            # Sidebar, Topbar, AppLayout
├── hooks/
│   └── useAuth.ts         # Auth hook
├── lib/
│   ├── supabase.ts        # Browser client
│   ├── supabase-server.ts # Server client
│   └── utils.ts           # Helpers
└── types/
    └── supabase.ts        # TypeScript types
```
