# Playbook: put the site on the public internet (Cloudflare Pages)

**Status: nothing in this list has been started.** No Cloudflare project exists, no token or secret has been
created, and the repository variable `CLOUDFLARE_PAGES_PROJECT` is not set. The values below come from
`docs/CHECKPOINT.md` item 3, D-072 in `docs/DECISIONS.md` and `.github/workflows/deploy.yml`. **Cloudflare's current
screens were not checked**: wording of buttons and menus marked "inferred - confirm" is from memory of the console
and may have moved. Where the console differs, follow the console and fix this file.

Every step is **PRODUCTION**: there is no staging copy of Cloudflare here. One click or one value per step. Do them
in order. Step 10 is the one that switches uploading on, and step 11's first run is what puts the site on the
internet; both are done last and only when you say so. One earlier step can also put something public: step 6, if
Cloudflare insists on a first upload. Read it before you reach it.

**Money and accounts.** If you have no Cloudflare account, creating one is a step of its own and yours to decide.
Cloudflare Pages has a free plan (inferred - confirm). Stop if any screen asks for a payment method or a paid plan:
nothing in this list should cost money.

## Before you start

- Fill in the About page's gaps: search the repository for `TO DECIDE` (they are all in `config/site.json`).
  The site is public once step 11's run has uploaded it, and the About page says it is a draft while any gap is
  left.
- **Choose the project's name first.** It becomes the site's public address, `<name>.pages.dev` (D-055), and the
  site's name and domain are not decided (`docs/CHECKPOINT.md`, questions). The steps below write
  `nz-vehicle-registrations`, the name used so far, as the default: put your own in its place everywhere it
  appears. A Pages project cannot be renamed afterwards (inferred - confirm): a wrong name means deleting the
  project and starting again.
- The cube the site is built from should hold the fact table first (`docs/STATE.md`, known issues), or the public
  Build page offers no conditions.

## Cloudflare: the Pages project

1. PRODUCTION. Sign in to the Cloudflare dashboard (inferred - confirm: `dash.cloudflare.com`).
2. PRODUCTION. In the left menu, open Workers & Pages (inferred - confirm).
3. PRODUCTION. Choose Create, then the Pages tab (inferred - confirm).
4. PRODUCTION. Choose "Upload assets" / Direct Upload, not "Connect to Git" (inferred - confirm the wording). The
   site is uploaded by `deploy.yml`; Cloudflare must not build it.
5. PRODUCTION. Project name: the name you chose (default `nz-vehicle-registrations`). The site will be at
   `<name>.pages.dev` (D-055).
6. PRODUCTION. Create the project. If the console asks you to upload files now, skip it. **If it will not let you
   skip (inferred - confirm), stop here and say so before uploading anything:** whatever is uploaded is served at
   `<name>.pages.dev` straight away, before step 10. If you then choose to go on, upload one empty page and nothing
   else; the first real deploy replaces it.

## Cloudflare: the token and the account id

7. PRODUCTION. Create an API token: profile menu, My Profile, API Tokens, Create Token, "Create Custom Token"
   (inferred - confirm). Name: `<name> deploy`. One permission only: Account, Cloudflare Pages,
   Edit. Account Resources: your account only. Create it and copy the token once; it is shown once.
8. PRODUCTION. Copy your Account ID (inferred - confirm: Workers & Pages overview, right-hand side, or the account's
   home page URL).

## GitHub: the two secrets, in the environment `production`

The environment `production` exists already, limited to the branch `main` (D-072). The secrets go in the
environment, not the repository.

9a. PRODUCTION. Repository on GitHub, Settings, Environments, `production`, Environment secrets, Add secret.
    Name `CLOUDFLARE_API_TOKEN`; value the token from step 7.
9b. PRODUCTION. Same page, Add secret. Name `CLOUDFLARE_ACCOUNT_ID`; value the Account ID from step 8.

## The switch: last, on your word

10. PRODUCTION. Set the repository variable `CLOUDFLARE_PAGES_PROJECT` to the project's name: Settings,
    Secrets and variables, Actions, Variables tab, New repository variable. Or say "set the variable" and Claude
    sets it with `gh`. **This switches uploading on.** From then on, every run of `Deploy` on `main` uploads
    the site, and the first such run makes it public. Until it is set, `Deploy` builds the site and stops, green, and nothing is uploaded (D-072).
11. PRODUCTION. Start the first deploy: Actions, `Deploy`, Run workflow, branch `main`. Once it is green, open
    `https://<name>.pages.dev` and check `/`, `/build`, `/about`, `/feedback` and `/differences`. A
    missing secret fails the run with a message that names it (D-072).

## Undoing it

- Take the site down from the repository's side: delete the variable `CLOUDFLARE_PAGES_PROJECT`. The next runs build
  and stop. The last upload stays served until you remove it in Cloudflare (Pages project, Deployments; inferred -
  confirm) or delete the project.
- Revoke the token in Cloudflare (My Profile, API Tokens) and delete the two secrets in the environment.
