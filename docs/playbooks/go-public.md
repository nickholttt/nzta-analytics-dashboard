# Playbook: put the site on the public internet (Cloudflare Pages)

**Status: nothing in this list has been started.** No Cloudflare project exists, no token or secret has been
created, and the repository variable `CLOUDFLARE_PAGES_PROJECT` is not set. The values below come from
`docs/CHECKPOINT.md` item 3, D-072 in `docs/DECISIONS.md` and `.github/workflows/deploy.yml`. **Cloudflare's current
screens were not checked**: wording of buttons and menus marked "inferred - confirm" is from memory of the console
and may have moved. Where the console differs, follow the console and fix this file.

Every step is **PRODUCTION**: there is no staging copy of Cloudflare here. One click or one value per step. Do them
in order. Step 9 is the one that makes the site public, and it is done last and only when you say so.

## Before you start

- Fill in the About page's gaps: search the repository for `TO DECIDE` (they are all in `config/site.json`).
  The site is public the moment step 9 is done, and the About page says it is a draft while any gap is left.
- CHECKPOINT item 3's earlier steps (the forced run of October, the merge of 47) come first. This file starts at
  the Cloudflare console.

## Cloudflare: the Pages project

1. PRODUCTION. Sign in to the Cloudflare dashboard (inferred - confirm: `dash.cloudflare.com`).
2. PRODUCTION. In the left menu, open Workers & Pages (inferred - confirm).
3. PRODUCTION. Choose Create, then the Pages tab (inferred - confirm).
4. PRODUCTION. Choose "Upload assets" / Direct Upload, not "Connect to Git" (inferred - confirm the wording). The
   site is uploaded by `deploy.yml`; Cloudflare must not build it.
5. PRODUCTION. Project name: `nz-vehicle-registrations`. The site will be at `nz-vehicle-registrations.pages.dev`
   (D-055: the name becomes `<name>.pages.dev`).
6. PRODUCTION. Create the project. If the console asks you to upload files now, skip it (inferred - confirm: it may
   insist on a first upload; if so, upload any one small file, and the first real deploy replaces it).

## Cloudflare: the token and the account id

7. PRODUCTION. Create an API token: profile menu, My Profile, API Tokens, Create Token, "Create Custom Token"
   (inferred - confirm). Name: `nz-vehicle-registrations deploy`. One permission only: Account, Cloudflare Pages,
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

10. PRODUCTION. Set the repository variable `CLOUDFLARE_PAGES_PROJECT` to `nz-vehicle-registrations`: Settings,
    Secrets and variables, Actions, Variables tab, New repository variable. Or say "set the variable" and Claude
    sets it with `gh`. **This is what makes the site public.** From then on, every run of `Deploy` on `main` uploads
    the site. Until it is set, `Deploy` builds the site and stops, green, and nothing is uploaded (D-072).
11. PRODUCTION. Start the first deploy: Actions, `Deploy`, Run workflow, branch `main`. Once it is green, open
    `https://nz-vehicle-registrations.pages.dev` and check `/`, `/build`, `/about`, `/feedback` and `/differences`. A
    missing secret fails the run with a message that names it (D-072).

## Undoing it

- Take the site down from the repository's side: delete the variable `CLOUDFLARE_PAGES_PROJECT`. The next runs build
  and stop. The last upload stays served until you remove it in Cloudflare (Pages project, Deployments; inferred -
  confirm) or delete the project.
- Revoke the token in Cloudflare (My Profile, API Tokens) and delete the two secrets in the environment.
