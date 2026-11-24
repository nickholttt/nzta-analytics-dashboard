# Playbook: put the site on the public internet (Cloudflare Pages)

**Status: nothing in this list has been started.** No Cloudflare project exists, no token or secret has been
created, and the repository variable `CLOUDFLARE_PAGES_PROJECT` is not set. Names below are the ones
`.github/workflows/deploy.yml` reads (D-056, D-057, D-072). Console labels were checked on 2026-11-24 against
developers.cloudflare.com and docs.github.com; a label not found there is marked "inferred — confirm". Where a screen
differs, follow the screen and fix this file.

Do the steps in order, one at a time. Cloudflare has no staging copy here, so every Cloudflare and GitHub step below is
PRODUCTION. Nothing is public until step 4 is done and a `Deploy` run on `main` finishes.

**Accounts and money.** Step 1 needs a Cloudflare account; creating one is yours to decide. The Pages Free plan's limits,
from developers.cloudflare.com/pages/platform/limits/ (read 2026-11-24): 20,000 files a site, 25 MiB a file, 100 projects
an account, 500 builds a month (our builds run on GitHub, not Cloudflare). The page states no limit on uploads a day.
`scripts/host-limits.mjs` holds the first two, and `scripts/check-public-build.mjs` fails the `Deploy` build before the
upload if either is passed. Nothing here should ask for a card; if a screen does, stop.

## Before you start

Still not done in the repo (`docs/CHECKPOINT.md`, `docs/STATE.md`):

- The site's name and web address (`config/site.json`, `site_name` and `site_address`) are undecided, and the About page
  says it is a draft while any `TO DECIDE` is left. This playbook works with a `pages.dev` address alone; leave
  `site_address` as it is until you choose one.
- The About page's other gaps: search the repository for `TO DECIDE`. Read its privacy sentence again before going live
  (D-096).
- The social cards are redrawn after the site is named (`scripts/make-social-cards.mjs`).
- Choose the Pages project's name now. **Yours to choose:** it becomes the public address `<name>.pages.dev`, and a Pages
  project cannot be renamed afterwards (inferred — confirm); a wrong name means a new project. Below, `<name>` is that
  name. A custom domain is a later, separate step and not covered here.

## 1. The Cloudflare Pages project (PRODUCTION; undo: delete the project)

Relied on by `deploy.yml`, job `upload`, step "Upload to Cloudflare Pages", which runs
`wrangler pages deploy dist --project-name "$PROJECT" --branch main --commit-dirty=true`. The project must exist and its
production branch must be `main`, or the upload is filed as a preview and `<name>.pages.dev` stays empty.

1. Create a Cloudflare account at dash.cloudflare.com if you have none (Free plan, no card).
2. In a terminal at the repository's root, install the upload tool the workflow itself uses, pinned at wrangler 4.148.0
   (D-057): `npm ci --prefix .github/deploy`. It adds a `node_modules` folder under `.github/deploy` and changes no
   tracked file. The three wrangler commands below were checked against that version's own help on 2026-11-24; none
   was run against Cloudflare.
3. Run `npx --prefix .github/deploy wrangler login` and approve in the browser. It signs this computer in to your
   Cloudflare account and changes nothing in the repository; `npx --prefix .github/deploy wrangler logout` undoes it
   (the logout command is inferred — confirm).
4. Run `npx --prefix .github/deploy wrangler pages project create <name> --production-branch main`. It makes an empty
   Direct Upload project with production branch `main` and uploads nothing, so nothing is public.
5. Run `npx --prefix .github/deploy wrangler whoami` and copy the Account ID it prints beside your account's name
   (what it prints is inferred — confirm). You need it in step 3.
6. Dashboard route instead (not preferred): Workers & Pages, Create application, Get started, Drag and drop your files,
   type `<name>`, Deploy site. Cloudflare's page does not say whether the project can be made without files, and offers no
   dashboard control for the production branch, so this route may publish a first upload at once and may leave the branch
   at Cloudflare's default (inferred — confirm). If you use it, upload one empty page only.
7. Check: Workers & Pages lists `<name>`, and its production branch is `main` (inferred — confirm where it shows; once
   deployed, the Deployments list marks each deploy Production or Preview).

## 2. The API token (PRODUCTION; undo: delete the token in the same list)

Relied on by `deploy.yml`, job `upload`, step "Upload to Cloudflare Pages", as `CLOUDFLARE_API_TOKEN`.

1. Dashboard, My Profile, API Tokens, Create Token.
2. Start from scratch (the docs' wording; "Create Custom Token" is inferred — confirm).
3. Token name: `<name> deploy`.
4. One policy: type Account, your own account, permission Cloudflare Pages, Edit (docs: "Account > Cloudflare Pages >
   Edit"). Nothing else.
5. Optional: a Token expiration. If set, deploys fail on that date until you make a new token.
6. Continue to summary, Create Token. The token is shown once: keep the page open until step 3 is done.
7. The Account ID is the one from section 1, step 5. In the dashboard, the docs place it on a zone's Overview page, in
   the right-hand menu under "API"; with no zone, try the Workers & Pages overview, right-hand side (inferred —
   confirm).

## 3. The two secrets in GitHub (PRODUCTION; undo: delete both)

They are **environment secrets of the environment `production`**, not repository secrets. The environment exists
already, limited to the branch `main`, with no required reviewer, no secret, and no repository variable set (read
from GitHub on 2026-11-24; D-072). `deploy.yml`, job `upload`, step "The Cloudflare
secrets are set" fails the run, naming them, if either is missing; step "Upload to Cloudflare Pages" reads both.

1. github.com/nickholttt/nzta-analytics-dashboard, Settings, Environments (left sidebar), `production`.
2. Under Environment secrets, Add secret. Name `CLOUDFLARE_API_TOKEN`; Secret: the token from step 2; Add secret.
3. Add secret again. Name `CLOUDFLARE_ACCOUNT_ID`; Secret: the Account ID from section 1, step 5; Add secret.
4. Check the page shows no required reviewer and deployment branches limited to `main`. The workflow expects no
   reviewer; one would hold every upload, the monthly one included, until someone approves.

## 4. The switch (PRODUCTION; this step can make the site public)

Relied on by `deploy.yml`, job `build`, step "Will it be uploaded": it sets `upload=true` only on `main` and only when the
repository variable `CLOUDFLARE_PAGES_PROJECT` is not empty, and job `upload` starts only then. Until then every run
builds, checks and stops green.

1. Same repository, Settings, Secrets and variables (Security section), Actions, Variables tab, New repository variable.
2. Name `CLOUDFLARE_PAGES_PROJECT`; Value `<name>`; Add variable. A variable, not a secret. Saving it uploads nothing by
   itself, but from this moment the next push to `main` that changes the site, and the next built month, upload without
   asking. Do step 3 straight away so the first upload is one you are watching.
3. Start the first deploy, only on your word: Actions, `Deploy`, Run workflow, branch `main`. After this, uploads also
   happen on a push to `main` that changes the site, and after each built month (`monthly-build.yml`, job `deploy`, step
   "Start the deploy").

## 5. What to look at afterwards

1. Actions, the `Deploy` run: jobs `build` and `upload` green. Its summary names the cube used ("Cube: release
   cube-YYYY-MM"). A red run names the cause; a missing secret says which.
2. Open `https://<name>.pages.dev` and check `/`, `/canvas`, `/about`, `/feedback`, `/differences`, `/method` and
   `/caveats`. An old `/build` link should land on the canvas. An address that does not exist, such as `/nothing-here`,
   should show the not-found page.
3. `/status` and `/sense-check` must return not found. If either loads, switch off (step 6) and report it.
4. Look at one page at phone width and in both themes, and follow one figure to its definition.

## 6. Switching it off

1. Stop new uploads: Settings, Secrets and variables, Actions, Variables, delete `CLOUDFLARE_PAGES_PROJECT` (GitHub's
   docs page gives no delete path; the control is beside the variable, inferred — confirm). Later runs build and stop.
2. Take the live site down: the last upload stays served. In Cloudflare, Workers & Pages, `<name>`, remove the deployment
   or delete the project (labels inferred — confirm). Deleting the project frees the name.
3. Revoke the token (My Profile, API Tokens) and delete the two secrets in `production`.
4. Switching on again is steps 1 to 4 again as far as they were undone.
