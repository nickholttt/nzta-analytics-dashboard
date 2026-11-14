# Proposal: how to host the query service (draft decision record)

A draft for the user to decide. It is not in `docs/DECISIONS.md` and nothing has been provisioned,
signed up for or paid for. When the user decides, it becomes a numbered entry there. The service
itself is specified in `docs/QUERY_SERVICE.md`, with the measurements this draft quotes.

```
## D-NNN 2026-11-14 — How the query service is hosted (proposed)
```

- **Agent:** claude (work order 1, package G).
- **Basis:** the local prototype and its measurements of 2026-11-14 (`docs/QUERY_SERVICE.md`); the
  providers' own pricing and limits pages, read on 2026-11-14 (addresses below); CLAUDE.md
  invariant 6; the brief §9 Stage 2 item 2; the work order §5.G.

## Context

Build, the page where a visitor asks their own question, today downloads the parts of the fact
table it needs and does the sums in the visitor's browser. The user decided on 2026-11-13 that it
should instead ask a hosted "query service": the browser sends the question, the service does the
sums and sends back only the handful of numbers the chart needs (CLAUDE.md invariant 6).

What was measured on this computer, with a local prototype (all figures from
`docs/QUERY_SERVICE.md`):

- **On the phone profile** (390 px wide, slow mobile network, slow processor), the first answer to
  a question took **7.4 s, 8.9 s and 11.6 s** for questions naming 3, 5 and 8 fields when the
  browser does the sums, and **4.2 s, 5.0 s and 5.0 s** with the service. The browser downloaded
  1.0 to 1.7 MB without the service and about 0.5 MB with it.
- **The service's local figures are a floor.** The prototype ran beside the browser: no distance,
  no waking up. A hosted one adds the trip to its data centre and, after a quiet spell, the time to
  wake.
- **Neither meets the brief's 3-second target on a phone.** With the service, most of what remains
  is the page's own code and fonts (460 KB, about 2.4 s at that network speed). The service is part
  of the answer, not all of it.
- **The service's work is small:** 34 to 157 ms per request on this computer, a few kilobytes per
  answer (5 KB for a chart, 40 to 58 KB for everything one question asks for), and a fraction of a
  millisecond once an answer is stored. The register changes once a month, so most questions can
  be answered from the store.

The site is hosted on Cloudflare Pages (planned; nothing is deployed) and built by GitHub Actions,
which also runs the monthly data build.

## How the costs below are worked out

- **Traffic.** "Low" is 10,000 Build questions a month (about 330 a day). "Higher" is 300,000 a
  month (about 10,000 a day). Neither is a forecast: the site has no visitors yet. Each question
  sends 4 to 9 requests (one for the chart, one for each list of values to choose from); 6 is used,
  so low is 60,000 requests a month and higher 1,800,000.
- **Worst case for compute:** every request is worked out afresh, none from the store. Real costs
  would be lower.
- **Prices are in US dollars**, as published, per month, read on 2026-11-14. A figure marked
  *estimate* rests on an assumption stated beside it; *not read* means the page could not be read
  and no figure is given.

## Options considered

### 1. No service: keep the sums in the browser, and make the files lighter

- **What it is.** What Build does today. It could be made lighter by publishing the last ten years
  of the fact table as their own files, since a question that names values opens on ten years:
  measured, that cuts what a question downloads by more than half (8 fields: 1,198 KB to 506 KB).
- **Cost:** $0 at both traffic levels. The files are static, served by Cloudflare Pages like the
  rest of the site.
- **Speed:** measured 7.4 to 11.6 s on the phone today. With the lighter files, *estimate* about 3
  to 4 s less for 8 fields (700 KB less at 1.6 Mbps); not measured.
- **Wake-up after a quiet spell:** none.
- **Monthly refresh:** nothing new; the monthly build already writes the files.
- **When something is down:** nothing extra can be down.
- **Accounts and secrets:** none new.
- **Why not chosen:** it does not do what the user asked: a phone still downloads part of a
  table, and the more fields a question names the slower it gets. Every field bound in package F
  adds a column. It stays the fallback, and the lighter files are worth doing anyway.

### 2. A small function at Cloudflare's edge, deployed with the site (recommended)

- **What it is.** A Pages Function, which is a Cloudflare Worker that ships inside the same
  Pages project as the site. It reads the fact-table files the site already publishes (Pages
  Functions can fetch the project's own static files, `env.ASSETS.fetch()`), does the same sums the
  browser does today (the same code as `factView`, which the prototype's answers were checked
  against), and keeps each answer in Cloudflare's cache.
- **Cost:** Workers Paid is needed, because the Free plan allows 10 ms of processing per request
  and the sums took 13 to 18 ms per question on this computer.
  - Low: **$5.00** (the plan's minimum, which includes 10 million requests and 30 million CPU-ms).
  - Higher: **about $5 to $6**, *estimate*: 1.8 million requests × about 20 ms = 36 million CPU-ms,
    6 million over the included amount at $0.02 per million ($0.12), plus the time a fresh copy
    spends reading the files (1.3 s for all 14 files on this computer; how often a copy starts
    fresh is not known).
  - Answers kept in the cache: Cloudflare's cache page states no charge; a request answered from
    the cache is still billed as a request, within the 10 million included.
  - Pages: Workers pricing, https://developers.cloudflare.com/workers/platform/pricing/; Pages
    Functions billed as Workers, https://developers.cloudflare.com/pages/functions/pricing/; both
    read 2026-11-14.
- **Wake-up after a quiet spell:** Cloudflare says its model "eliminates the cold starts of the
  virtual machine model" and gives no figure
  (https://developers.cloudflare.com/workers/reference/how-workers-works/). A fresh copy must still
  read the files before its first answer: up to 1.3 s on this computer for all 14, less for the few
  a question names. Not measured on Cloudflare.
- **Monthly refresh:** nothing new. The function and the files are uploaded together by the
  existing deploy (`deploy.yml`), so a new month's answers start with the new files.
- **When it is down:** if Pages is up, its functions normally are too; if the function fails, Build
  says plainly that the question service is not answering and Explore keeps working (checked with
  the prototype). If Cloudflare is down, the whole site is down, service or not.
- **Accounts and secrets:** no new account and no new secret; the Workers Paid plan on the
  Cloudflare account the site is already planned for. It costs money, so the user must agree.
- **The risk, and the first step if chosen.** Each copy may use at most 128 MB of memory
  (https://developers.cloudflare.com/workers/platform/limits/, read 2026-11-14). Read the way the
  browser reads them, the 14 files took 119 MB on this computer: too close. Held as small number
  codes instead of text, the table would need about 20 MB (*estimate*: 641,618 rows × 14 columns ×
  2 bytes, plus the counts). That change and a measurement on Cloudflare itself come before
  anything else; measuring there needs the paid plan.
- **A second risk: this is not the engine that was measured.** The prototype that was built and
  timed is Python with DuckDB. This option sums in JavaScript, and its checks (the public list,
  the limits, the minimum count, refusing anything that is not a question) would be written a
  second time. Its summing is the browser's own code, checked against the prototype on the three
  measured questions; its checks are not written yet. To keep the two from drifting, the hostile and
  limit cases are kept as data (`scripts/query_service_prototype/cases.json`: each request, the
  status it must get, and where it applies the totals it must give), which the prototype's tests
  read and any later implementation must pass.
- **Why chosen:** the cheapest real service; one provider, one deploy, no new secret; no machine
  to wake; the monthly refresh is the deploy that already exists; and it is the browser's own,
  arithmetic moved to a server, so its sums are the ones Build already draws (its checks are new
  code; see the second risk above).

### 3. A small container running the prototype as it is (DuckDB)

- **What it is.** The measured prototype, packaged as a container and run by a host that starts it
  when asked and lets it sleep when idle. It needs about 0.5 GB of memory (507 MB at its peak here)
  and takes 2.0 to 2.2 s to load the table when it starts.
- **Hosts read, and their costs:**
  - **Cloudflare Containers**, on the same Cloudflare account, behind a Worker. Workers Paid ($5)
    includes 25 GiB-hours of memory, 375 vCPU-minutes and 200 GB-hours of disk a month. Beyond
    that: memory $0.0000025 per GiB-second, CPU $0.000020 per vCPU-second of active use, disk
    $0.00000007 per GB-second. The "basic" instance (1/4 vCPU, 1 GiB) fits.
    - Asleep when idle, low traffic: **about $5 to $6**, *estimate* (depends on how long it stays
      awake; nothing above the included amounts while it is awake under about 50 minutes a day,
      the 25 GiB-hours included).
    - Kept awake all month, so no visitor waits for it to wake: **about $12 low, about $15
      higher**, *estimate*: memory $6.35 and disk $0.69 (the basic instance's 4 GB) above the included amounts, CPU $0 low
      and $3.15 higher (1.8 million requests × 0.1 s). Durable Objects, which every container uses,
      are billed too; their prices were not read.
    - https://developers.cloudflare.com/containers/pricing/, read 2026-11-14. Whether the product
      is in beta is not stated on the pages read; its FAQ says automatic scaling is not available
      "today".
  - **Fly.io**: a 1 GB shared-CPU machine is **$6.70 a month** running all the time (low and
    higher alike: one machine handles both); a stopped machine pays only for its disk ($0.15 per
    GB-month). https://docs.fly.io/about/pricing, read 2026-11-14. That price is for its
    "lowest-priced regions" (Ashburn and Secaucus, in the United States); the same page shows the
    machine at $7.73 in Frankfurt and $8.50 in Singapore, and names no price for Sydney. The region
    nearest New Zealand is likely to cost more than $6.70.
  - **Google Cloud Run**: its free tier is 2 million requests, 180,000 vCPU-seconds and 360,000
    GB-seconds a month (https://docs.cloud.google.com/free/docs/free-cloud-features, read
    2026-11-14), so low traffic would be **$0** and higher traffic close to the free limit. Its
    prices beyond the free tier are **not read**: the pricing page
    (https://cloud.google.com/run/pricing) returned no content to the reader.
- **Wake-up after a quiet spell:** Cloudflare says "Container cold starts can often be in the 1-3
  second range", depending on image size and start-up code
  (https://developers.cloudflare.com/containers/platform-details/architecture/, read 2026-11-14);
  Fly.io says "A cold start takes about 2 seconds or more for common apps"
  (https://docs.fly.io/launch/autostop-autostart, read 2026-11-14); Google gives no figure on the
  page read (https://docs.cloud.google.com/run/docs/tips/general). Add the prototype's own 2.0 to
  2.2 s to load the table (measured): **about 3 to 5 s** before the first answer after a quiet
  spell, *estimate*, unless it is kept awake (and paid for). The providers' figures are their own
  general statements, not measured for this container.
- **Monthly refresh:** a new container each month with the new files, or one that fetches the
  newest files when it starts. A step in GitHub Actions that deploys to the host.
- **When it is down:** the same as option 2 for visitors. More can go wrong: a container, its
  host, and (on Cloudflare) the Worker and Durable Object in front of it.
- **Accounts and secrets:** Cloudflare Containers needs the Workers Paid plan and a Cloudflare
  token allowed to deploy Workers (*inferred — confirm*); Fly.io and Google Cloud each need a new
  account with a payment card and a deploy token kept as a GitHub secret.
- **Why not chosen:** it is the measured prototype, which is its strength, but at low traffic a
  visitor would often meet a 3 to 5 s wake-up, and avoiding that costs more than option 2 every
  month. It is the first fallback if option 2's memory check fails, and the better choice if the
  table grows far beyond today's (DuckDB handles large tables; a Worker's 128 MB does not).

### 4. A managed analytics database (MotherDuck), with a small function in front

- **What it is.** The table is uploaded each month to MotherDuck, a hosted DuckDB. The browser
  cannot be given its password and must not send SQL, so a small function (as in option 2) still
  sits in front and writes the query.
- **Cost:** the Lite plan is $0 and includes 10 hours of compute a month, billed per query with a
  1-second minimum: about 36,000 requests worked out afresh a month, or 6,000 questions at 6
  requests each.
  - Low traffic: in the worst case (60,000 requests, all worked out afresh) that is about 17
    compute-hours, over the Lite allowance; what Lite does above it was not read, so the worst
    case is taken as the Business plan, **about $260** ($250 plus about 17 hours at $0.60, $10),
    plus the function. If most answers come from the store, **$0**, plus the function
    ($0 to $5). *Estimate.*
  - Higher traffic in the worst case: **about $555** a month, *estimate*: the Business plan
    ($250), about 500 compute-hours at $0.60 ($300), and the function on Workers Paid ($5).
  - https://motherduck.com/product/pricing/, read 2026-11-14.
- **Wake-up after a quiet spell:** MotherDuck says "Ducklings stay on warm standby, so they start in
  about 100 ms" (https://motherduck.com/docs/concepts/architecture-and-capabilities/, read
  2026-11-14): its own general statement, not measured here. The function in front adds its own
  start, as in option 2.
- **Monthly refresh:** an upload from GitHub Actions with a MotherDuck token kept as a secret.
- **When it is down:** two services can fail, the function and MotherDuck.
- **Accounts and secrets:** a new MotherDuck account; a token in GitHub and in the function.
- **Why not chosen:** it costs the most at higher traffic, adds a provider and a secret, still needs
  the function of option 2, and how that function would connect to MotherDuck was not confirmed in
  the documentation read. Its strength, any SQL at scale, is more than summing one table needs.

## Decision (proposed)

**Option 2: a Pages Function at Cloudflare, on the Workers Paid plan (US$5 a month), deployed with
the site, doing the same sums the browser does today and keeping each answer in Cloudflare's
cache.** It is the cheapest real service, adds no provider, account or secret, has no machine to
wake, and the monthly refresh is the deploy that already exists.

Before it is built:

1. The user agrees to the Workers Paid plan (it costs money: the work order §3).
2. A short spike: the table held as number codes, measured in a Pages Function on Cloudflare for
   memory, the time a fresh copy needs before its first answer, and the processing per question.
3. It passes the work order's acceptance question at 390 and 1280 px, and only then is the
   `PUBLIC_QUERY_SERVICE` setting switched on for the public build (the brief §9 Stage 2, the seam).

**What would make me choose differently:**

- If the spike shows the table cannot be held well under 128 MB, or a fresh copy takes more than
  about a second to answer: **option 3 on Cloudflare Containers** (same account), kept awake if the
  wake-up proves too slow, or Fly.io if a second provider is acceptable.
- If the user wants no running cost at all: **option 1**, with the last ten years as their own files,
  accepting that a phone waits several seconds longer and downloads part of the table.
- If the fields bound in package F make the table many times larger: **option 3**.
- If the user wants answers to questions far beyond summing the table: option 4 would be looked at
  again.

**Whichever is chosen, the page needs to get lighter too:** the 3-second target on a phone is
not met by the service alone (`docs/QUERY_SERVICE.md`, Measurements).

## Consequences

- Build keeps reading the fact table in the browser until the service passes the acceptance
  question; the site behaves exactly as today until then.
- The prototype in `scripts/query_service_prototype/` stays the reference for what the service
  checks and returns: the public list, the limits, the minimum-count hook, the one spelling of a
  question, the answer's shape. The hosted version must pass the same checks.
- A link pinned to a month keeps working only while the service can answer for that month. The
  prototype keeps answers it has already given, nothing more (`docs/QUERY_SERVICE.md`, Keeping
  answers). The hosted service must either keep each month's fact table (a few MB a month) or carry
  stored answers forward; keeping the tables is the simpler and is assumed in option 2's costs,
  which are not changed by a few more files.
- The static fact table keeps being published while Build might fall back to it or the service is
  being proved. Whether to stop publishing it once the service is live is a later decision.
- A running cost of US$5 a month, and a dependence on Cloudflare for Build as well as for hosting.
- To undo: switch the setting off and rebuild; Build returns to the static files the same day.

## Choices made inside this proposal, for review

1. "Low" and "higher" traffic are 10,000 and 300,000 Build questions a month, at 6 requests each.
2. Costs are worked out for the worst case, with nothing answered from the store.
3. When the service is down, Build does not quietly fall back to the static fact table; it says the
   service is not answering (`docs/QUERY_SERVICE.md`, When the service is down).
4. The measure (share or number) and the chart's settings are not part of the stored question, so
   one answer serves them all.
5. The phone profile's upload speed, not recorded before, was set at 750 kbps for both sides.
6. A hosted service keeps each month's fact table, so a link pinned to any month keeps working.

## Status

Proposed, for the user to decide. Nothing is provisioned. Also open for the user: the brief §12
question 2, "what monthly cost is acceptable for the query service?"
