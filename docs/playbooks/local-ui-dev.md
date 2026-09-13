# Playbook: run the local UI

The site runs locally only; nothing is deployed. It reads `public/data/` (gitignored), so that
directory has to exist first. If it doesn't, see `docs/playbooks/refresh-public-data.md`.

## Start

```bash
test -f public/data/manifest.json || echo "public/data missing: see refresh-public-data.md"
npm run dev
```

- Serves on `http://127.0.0.1:4321/`. Host and port are fixed in `astro.config.mjs`.
- Astro 7 runs the dev server **in the background**: `npm run dev` prints
  `Dev server running at http://127.0.0.1:4321 (pid N)` and the server keeps running after the npm
  process exits. Killing the npm process does not stop it.

## Check and stop

```bash
npx astro dev status     # "Dev server running at ... (pid N, uptime Ns, background)"
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4321/                   # 200
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4321/data/manifest.json # 200
npx astro dev stop       # "Stopped dev server (pid N)."
```

Before starting a server, run `npx astro dev status`. The user may already have one running for a
review. Don't stop a server you didn't start.

## Visual verification

- No browser test harness is committed. Earlier Claude sessions drove the dev server with a
  headless Chromium (Playwright) installed in a scratch directory outside the repo. It is not
  reproducible from the repo, so ask the user before adding one.
- Checking the page, not only the build, matters: `astro build` does not typecheck (see
  `docs/playbooks/run-checks.md`).

## Real example: 2026-09-13

`npm run dev` → index returned 200 within 1 s, `/data/manifest.json` returned 200 →
`npx astro dev status` reported pid 45972 in the background → `npx astro dev stop` stopped it and
port 4321 was free again.
