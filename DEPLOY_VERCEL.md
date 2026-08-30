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

The three required `VITE_*` variables are already set in `vercel.json` as plain
strings (Vercel’s schema requires `env` values to be strings, not objects).
They are publishable client keys, so it is safe to include them in the build
config. Never add the service-role key.

If you prefer to manage them manually in **Settings → Environment Variables**
instead, set their **Visibility** to **`Config`** (not `Secret`) — Vercel rejects
`VITE_` variables as secrets because they must be embedded in the browser build.

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
