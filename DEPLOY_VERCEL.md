# Deploying Expirify to Vercel

This is a TanStack Start (SSR) app built with Vite + Nitro. Nitro defaults to the
Cloudflare target inside Lovable, so the Vercel build switches the preset via
`NITRO_PRESET=vercel` (already set in `vercel.json`).

## 1. Get the code into Git

1. In Lovable, connect GitHub (top-right menu → GitHub) or export/download the project.
2. Push the repo to GitHub/GitLab/Bitbucket.

## 2. Import into Vercel

1. Vercel dashboard → **Add New… → Project** → import the repo.
2. Framework preset: **Other** (config comes from `vercel.json`).
3. Build command: `NITRO_PRESET=vercel bun run build`
4. Install command: `bun install`
5. Output: auto-detected (Nitro writes the Vercel Build Output API to `.vercel/output`).

## 3. Environment variables

Add these in **Settings → Environment Variables** for Production *and* Preview
(values are in your Lovable project `.env`; see `.env.example` for the names):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

**Important:** Because these variables start with the `VITE_` public framework
prefix, Vercel requires their **Visibility** to be set to **`Config`** (not
`Secret`). If you set them to `Secret`, Vercel will reject them with the error:
“Environment variables with a public framework prefix cannot use
`visibility: secret`. Use `visibility: config` instead.”

These are publishable client keys — safe to expose in the browser and in the
build. Never add the service-role key.

## 4. Update auth URLs

After the first deploy, in your backend auth settings add your Vercel domain to:

- **Site URL**: `https://your-app.vercel.app`
- **Redirect URLs**: `https://your-app.vercel.app/**`

Otherwise email confirmation and OAuth sign-ins will bounce back to the old domain.

## 5. Verify

- `/` landing page loads
- `/auth` sign-up + sign-in works (check the confirmation email link domain)
- `/dashboard` and `/scan` load after login (camera scanning requires HTTPS — Vercel provides it)

## Local build check

```bash
NITRO_PRESET=vercel bun run build
```

Output appears in `.vercel/output`.
