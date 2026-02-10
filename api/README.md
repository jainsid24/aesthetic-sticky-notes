# Proxy API (keeps keys off the extension)

Deploy this so your **Unsplash** and **OpenRouter** keys stay on the server. The extension calls your proxy; no keys are in the extension or visible in DevTools.

**You do not need a Vercel template.** You are deploying this existing repo (it already has `api/` and `vercel.json`).

---

## Option 1: Deploy from your computer (recommended)

1. Open a terminal in this project folder (where `api/` and `vercel.json` live).
2. Run:
   ```bash
   npx vercel
   ```
3. When prompted:
   - **Set up and deploy?** Yes
   - **Which scope?** Your account
   - **Link to existing project?** No
   - **Project name?** e.g. `aesthetic-notes-proxy` (or press Enter for the suggested name)
   - **In which directory is your code?** `./` (press Enter)
4. After the first deploy, add your keys:
   - Open [Vercel Dashboard](https://vercel.com/dashboard) → your project → **Settings** → **Environment Variables**
   - Add:
     - **Name:** `UNSPLASH_ACCESS_KEY` → **Value:** your Unsplash Access Key
     - **Name:** `OPENROUTER_API_KEY` → **Value:** your OpenRouter API key
   - Save, then go to **Deployments** → ⋮ on the latest → **Redeploy** (so the new env vars are used).
5. Copy your project URL (e.g. `https://aesthetic-notes-proxy.vercel.app`) and in this repo set it in **`script.js`** as `PROXY_BASE_URL`.

---

## Option 2: Deploy from Vercel dashboard (Git)

1. Push this repo to **GitHub** / **GitLab** / **Bitbucket**.
2. In [Vercel](https://vercel.com): **Add New…** → **Project**.
3. **Import** your repository (e.g. `aesthetic-sticky-notes`).
4. **Do not pick a framework template.** Leave “Framework Preset” as **Other** (or whatever is non-framework). The repo’s `vercel.json` tells Vercel how to build and run the `api/` functions.
5. **Root Directory:** leave as `.` (repo root).
6. Click **Deploy**. After it finishes, add env vars and redeploy as in Option 1 (step 4).
7. Set the deployment URL in **`script.js`** as `PROXY_BASE_URL`.

## Endpoints

- **GET /api/unsplash-random** – returns `{ "url": "https://images.unsplash.com/..." }` for the extension background.
- **POST /api/openrouter** – forwards the request body to OpenRouter with your API key and streams the response.

## Optional: other hosts

If you deploy elsewhere (not `*.vercel.app`), add that origin to `manifest.json` under `host_permissions` and `content_security_policy.extension_pages` → `connect-src`.
