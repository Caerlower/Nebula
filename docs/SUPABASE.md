# Supabase setup (Hub)

The old “Settings → Database → Connection string” page is gone / hard to find.
Use the **Connect** button instead.

## 1. Create Hub tables (SQL)

1. Open your project:  
   https://supabase.com/dashboard/project/rmbimouedfvtradauphv  
2. Left sidebar → **SQL Editor** → **New query**  
3. Paste everything from [`apps/nebula-hub/supabase/hub.sql`](../apps/nebula-hub/supabase/hub.sql)  
4. Click **Run**

You should see “Success. No rows returned.”

---

## 2. Get connection strings (current UI)

### Option A — Connect button (easiest)

1. Open the project dashboard  
2. Click **Connect** at the **top** of the page (next to the project name)  
   Direct link (opens the panel):  
   https://supabase.com/dashboard/project/rmbimouedfvtradauphv?showConnect=true  
3. Choose type **ORMs** → **Prisma** (or **Connection string**)  
4. You’ll see three URIs. Copy:

| Label in UI | Port | Put in `.env.local` as |
|-------------|------|-------------------------|
| **Transaction** pooler | `6543` | `DATABASE_URL` |
| **Session** pooler | `5432` | `DIRECT_URL` |

If the password shows as `[YOUR-PASSWORD]`, replace it with your **database password**.

### Option B — If you don’t remember the DB password

1. Open: https://supabase.com/dashboard/project/rmbimouedfvtradauphv/settings/database  
2. Find **Database password** → **Reset database password**  
3. Copy the new password  
4. Go back to **Connect** and paste that password into both URIs

---

## 3. Paste into `apps/nebula-hub/.env.local`

Example shape (yours will include the real password + region):

```bash
DATABASE_URL="postgresql://postgres.rmbimouedfvtradauphv:YOUR_PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.rmbimouedfvtradauphv:YOUR_PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres"
```

Keep your existing:

```bash
SUPABASE_URL=https://rmbimouedfvtradauphv.supabase.co
SUPABASE_SERVICE_ROLE_KEY=…
```

Then:

```bash
cd apps/nebula-hub
pnpm db:generate
```

---

## What this is *not*

- **API Keys / service_role** — you already have this; it’s for the waitlist REST client, **not** Prisma.
- **Project URL** — same; not a Postgres connection string.

Prisma needs the **Postgres** URI from **Connect**, which includes a **database password**.
