# Local Setup & Vercel Deployment Guide

## 1. Local Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure environment variables:
   - Copy `.env.example` to `.env` (gitignored).
   - Set `GEMINI_API_KEY` (Google AI Studio) and/or `OPENROUTER_API_KEY` (OpenRouter free-tier `:free` models), with `AI_PROVIDER="auto"`.
3. Start the local server (runs on port **3010** so it never collides with `localhost:3000`):
   ```bash
   # Fast production build & server (recommended on Windows):
   npm run build
   npm run start

   # Or hot-reload development server:
   npm run dev
   ```
4. Local persistence:
   - When `DATABASE_URL` is unset locally, all workspace data (topics, ideas, drafts, revisions, editorial memory, feedback, and settings) is stored automatically in `data/assistant.sqlite` (ignored by Git).
   - When `DATABASE_URL` or `POSTGRES_URL` is configured, workspace tables sync automatically with PostgreSQL (`lca_workspace_tables`).

## 2. Verification Commands

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## 3. Deploying Safely to GitHub & Vercel

1. **Push to a Private GitHub Repository**:
   ```bash
   git remote add origin https://github.com/<your-username>/<your-private-repo>.git
   git push -u origin main
   ```
   *(Note: `.env` and `data/` are excluded by `.gitignore` so your keys and local database are never pushed.)*

2. **Import Project in Vercel & Connect Neon Postgres**:
   - Go to **Vercel -> Add New Project** and import your GitHub repository.
   - In the Vercel project's **Storage** tab, click **Create Database -> Neon Serverless Postgres** (Free Tier) and connect it to the project. Vercel automatically injects `DATABASE_URL` / `POSTGRES_URL`, which `src/lib/db/cloud-sync.ts` uses to persist all drafts, ideas, and editorial memory across serverless invocations.

3. **Set Vercel Environment Variables**:
   Add these server-only variables in **Vercel -> Settings -> Environment Variables**:
   - `AI_PROVIDER` = `auto`
   - `GEMINI_API_KEY` = *(your Gemini key)*
   - `OPENROUTER_API_KEY` = *(your OpenRouter key)*
   - `APP_ACCESS_PASSWORD` = *(choose a personal passcode so only you can open the deployed app)*
   - `APP_SESSION_SECRET` = *(any long random string, e.g. 32+ characters, used to sign the login cookie)*

4. **Backups**:
   - Export a full JSON or Markdown backup anytime from **Settings -> Data Backup & Export** (`/api/export?format=json` or `/api/export?format=markdown`).
