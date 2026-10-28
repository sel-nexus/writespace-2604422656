# WriteSpace

A responsive, browser-local blog demo built with React 18, Vite, JavaScript JSX, React Router v6 and Tailwind CSS. Includes public discovery, registration/login, post reading and ownership-aware CRUD, and administrator account management/activity totals.

## Important demo boundary

**Never enter real passwords or sensitive content.** Passwords are intentionally plaintext in localStorage, as required by this local MVP. Built-in credentials are `admin` / `admin`. Client-side guards are convenience controls, not a security boundary against anyone who can modify browser storage. There is no backend, database, shared publication, synchronization, encryption, or external identity service. Each browser profile/origin has its own data; clearing site storage removes it. Private browsing may discard it.

Stored keys: `writespace_posts`, `writespace_users`, `writespace_session`. Removed users' posts retain their original author name. The built-in admin cannot be deleted; an administrator cannot delete their current account. Self-registration always creates the `user` role. Usernames are case-sensitive after trimming.

## Run locally

Requires Node.js 22+ and npm.

```sh
cd frontend
npm ci --no-bin-links
cp .env.example .env
npm run dev
```

Defaults: bind `0.0.0.0`, development port `5173`. `.env.example` documents public development/test configuration; this static client has no runtime secrets or API URL.

```sh
npm test
npm run build
npm run preview -- --host 0.0.0.0 --port 4173
```

The build produces `frontend/dist`. Package scripts invoke Node entry files directly and work when npm bin links are disabled.

## Browser verification

```sh
cd frontend
node node_modules/@playwright/test/cli.js install chromium
npm run build
npm run preview -- --host 0.0.0.0 --port 4173
```

In another terminal:

```sh
cd frontend
E2E_BASE_URL=http://127.0.0.1:4173 E2E_PORT=4173 npm run e2e
```

Without a running preview, the Playwright configuration starts Vite automatically. Chromium uses isolated contexts and one worker. Every journey checks console and uncaught browser errors. Preflight saves screenshots, accessibility snapshots, HTML and computed-style evidence into `frontend/test-results`; retained representative captures are in `review-evidence/`. Screenshots are human-review evidence, not an automated pixel-quality claim.

Verification completed in this stage: 362 unit/component tests passed. The 54-test browser run passed 53; an exact-text selector correction was followed by all 12 identity tests passing, covering the remaining journey. No tests were skipped. Production build passed. API, server-database and backend integration tests do not apply. Cross-feature flows are exercised through the real browser-local data layer. Browser tooling was upgraded to Playwright 1.64.1 after 1.49.1 hung before discovery. No unresolved browser infrastructure blocker remains.

## Routes

- `/`: public introduction and latest three local previews.
- `/login`, `/register`: guest entry; authenticated visitors return to their role home.
- `/blogs`, `/blog/:id`: authenticated list and full plaintext reading.
- `/write`, `/edit/:id`: post editor; users maintain only their own posts; admins maintain any post.
- `/admin`, `/users`: administrator dashboard and accounts.

Start Reading always takes authenticated visitors to `/blogs`; Go to Dashboard routes administrators to `/admin` and writers to `/blogs`.

## Static hosting

### Vercel

Set the Vercel project **Root Directory to `frontend`**. The frontend's `vercel.json` contains only the SPA rewrite, as required. Select the Vite preset with output `dist`; do not point the deployment root at the repository root. A root rewrite-only copy is retained for the pipeline contract. A live Vercel deployment was not performed or verified in this stage.

### nginx container

```sh
docker build -t writespace ./frontend
docker run --rm -p 8080:80 writespace
```

The two-stage Dockerfile builds with Node and serves `dist` through nginx, with an SPA fallback and no backend proxy. The Docker image itself was not built in this stage; the production Vite bundle and browser deep-link behavior were verified. No compose service is needed for a single static tier.

## Design and requirement decisions

Human-approved changes replace the forbidden indigo/violet/pink wallpaper with a stone-and-teal writing-oriented design and clarify the four totals as Total Posts, Total Accounts (including built-in admin), Total Admins and Total Writers. Roles are normalized to lowercase `admin`/`user`. SVG role avatars replace emoji under the run's UI rules.

The live writing invitation uses a reduced-motion-aware CSS pulse instead of literal floating movement, avoiding custom keyframes because the required stylesheet contains only the three Tailwind directives and the Tailwind extension stays empty. This is a documented motion substitution, not a claim of literal floating. Native typography pairs Georgia headings with Trebuchet MS body, with platform fallbacks.

Coverage configuration instruments utility files only; no whole-frontend percentage is claimed. Current dependencies retain the PRD's React/Tailwind/Vite major versions. Before use beyond this demo, perform dependency/security maintenance and replace browser-local plaintext identity with a real server-side security model.
