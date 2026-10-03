# Production launch preparation

This release prepares the current Skyhook Industries site to replace the original public website. It adds legacy redirects, production search metadata, help with moving saves, and browser checks. It does not change the public domain, merge either stacked pull request, or promote the branch to production.

The review address remains [dribbble-visual-redesign](https://dribbble-visual-redesign-skyhook-industries.imattoo.workers.dev/). Keep it available after launch so existing players can download their saves. The [original introduction film storyboard](storyboards/skyhook-introduction.md) is ready for review; production of that film can proceed independently of the website cutover.

## Legacy links

The original site's page and blog sitemaps were checked on 3 October 2026. `public/_redirects` preserves these seven destinations, with explicit rules for both trailing-slash variants. Each uses a permanent 301 redirect to specific retained content.

| Original path | Destination |
| --- | --- |
| `/team` | `/about/#founder` |
| `/ethos` | `/about/#principles` |
| `/the-skyhook` | `/system/` |
| `/mission-proposal` | `/archive/#mission-proposal` |
| `/mission-proposal/f/high-wire-act` | `/archive/#high-wire-act` |
| `/mission-proposal/f/orbital-bridges` | `/archive/#orbital-bridges` |
| `/mission-proposal/f/a-non-synchronous-orbital-skyhook` | `/archive/#non-synchronous-skyhook` |

The three historical research entries link to the author's original records. The archive identifies historical proposals separately from the current system and roadmap. The full third-party articles have not been copied into the new site.

Workers Static Assets supports these path redirects. Its `_redirects` file does not configure host redirects. The existing public site redirects `www.skyhook-industries.com` to `skyhook-industries.com`; reproduce that policy at the new host. Do not assume the old GoDaddy redirect remains after moving the domain. See [Cloudflare's redirect documentation](https://developers.cloudflare.com/workers/static-assets/redirects/).

Public routing was rechecked on 3 October 2026: authoritative nameservers are `ns13.domaincontrol.com` and `ns14.domaincontrol.com`, the apex A records are `13.248.243.5` and `76.223.105.230`, and `www` is a CNAME to the apex. The web records have a 3,600-second TTL; both public hostnames serve the existing GoDaddy site over valid HTTPS. Microsoft 365 mail and SPF/tenant records are also present. This public snapshot is not a complete DNS-zone backup.

The normal [Workers Custom Domain setup](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/) requires an active Cloudflare zone. Inspect the authorized account for an existing pending or partial zone before choosing the cutover sequence. If DNS authority moves, retain every record, including mail, and record the existing nameservers and hosting configuration for rollback. `wrangler.jsonc` currently declares no custom domains; neither the actual production branch binding nor the account's zone and certificate state has been verified.

## Indexing and build configuration

The canonical origin remains `https://skyhook-industries.com`. Production builds include public company pages, Help, the five Lab experiments, their guides, the architecture catalogue and Expeditions in the sitemap. The archive and 404 remain `noindex,follow` and stay out of the sitemap. Preview builds mark every page `noindex,follow` and produce no sitemap entries.

`src/site/deployment.mjs` defines the build policy:

- A manual or GitHub Actions release build uses `SKYHOOK_DEPLOYMENT=production`.
- Workers builds use the injected `WORKERS_CI_BRANCH`. Only a match with `SKYHOOK_PRODUCTION_BRANCH` enables production indexing. That configured name defaults to `main`; the actual dashboard binding must be verified before release.
- A production flag inherited by another Workers branch cannot enable indexing there. Missing branch information also keeps a Workers build in preview mode.
- `SKYHOOK_DEPLOYMENT=preview` always keeps preview indexing. Ordinary local builds default to preview.
- Branch shares continue to use the stable dribbble-visual-redesign address and its assets. Canonical links always identify the public site.

Validate both outputs on the same filesystem as the repository, because Astro moves generated assets with a filesystem rename:

```bash
SKYHOOK_DEPLOYMENT=production npm run build
SKYHOOK_DEPLOYMENT=production node --test tests/site-launch.test.mjs

SKYHOOK_DEPLOYMENT=preview WORKERS_CI_BRANCH=dribbble-visual-redesign npm run build -- --outDir qa/launch-preview-dist
SKYHOOK_DEPLOYMENT=preview WORKERS_CI_BRANCH=dribbble-visual-redesign SKYHOOK_TEST_DIST=qa/launch-preview-dist node --test tests/site-launch.test.mjs
```

The checks inspect every built page, compare sitemap entries with indexable routes, verify both environment policies and validate all redirect targets and anchors. Cloudflare can also supply an `X-Robots-Tag` header. Inspect the final public response headers after attaching the domain; correct HTML alone does not remove an externally configured `noindex` header.

## Moving saves

[Help and saves](https://dribbble-visual-redesign-skyhook-industries.imattoo.workers.dev/help/) gives visitors exact controls for backing up each network and each experiment. Link to it from both the company and Lab footers. Feedback goes through the existing public contact address at `/contact/#feedback`.

Saves do not cross site origins automatically. Export each campaign at the address where it was played, then import the files on the destination site. Imports create separate campaign slots and retain existing worlds. Campaign backups include the current state and commissioned Earth design, but do not carry checkpoint history.

Export Lab inputs separately. Earth and Moon, Phobos, T4, and the two CardioRotovator save sets have their own controls. Import restores the current inputs; choosing Save at the destination replaces that experiment's local saved design. Pinned flights, study results, unit preferences and Flight school completion are separate from design files.

`tests/site-launch.browser.py` rehearses actual file downloads and imports between two independent origins. It checks that campaign stocks, credits, flights, services and timing remain intact, that another destination world survives, and that the source remains unchanged. It also moves an Earth design, saves it at the destination and verifies it after reload. This is a transfer rehearsal with test data, not access to a player's browser storage.

## Verification and release gates

The new CI jobs exercise launch entry points and save transfers in Chromium, Firefox and WebKit. The existing full numerical, browser and persistence suites remain in place. Linux WebKit is useful compatibility evidence; it does not replace a hands-on Safari/iPhone check. Browser screenshots cover desktop and narrow phone layouts, while native Help content remains usable without JavaScript.

The initial launch-preparation commit `33198408bfcba5d23e3c2e1a7c56b5e9c61c376f` passed the full [GitHub workflow 37114184275](https://github.com/RelyOnFire/skyhook-industries/actions/runs/37114184275), including all three launch-browser jobs. Cloudflare build `0665a61f-8c0e-49ce-8db1-5733eebf8cf6` published that branch successfully. Later commits require their own checks; these results do not authorize production promotion.

A single local performance sample on 3 October used a Pixel 7 viewport, cold cache, 4× CPU slowdown, 150 ms latency and 1.6 Mbps download. With uncompressed local assets, the homepage transferred about 107 kB and reached largest contentful paint in 2.03 seconds; Help used 62 kB and 0.71 seconds. Both had zero measured layout shift. The initial Expeditions welcome screen used 1.10 MB, reached largest contentful paint in 3.55 seconds and showed its Start button in 4.00 seconds, with layout shift 0.091. Other QA processes may have shared the machine. These are synthetic observations, not field scores or a physical-phone guarantee; the detailed Lab was not timed by this probe.

The subsequent welcome improvement renders the introduction in the initial HTML, reserves the save-discovery/Continue slot, and defers map surface images until the welcome map is visible. A repeat with the same browser and throttling used 555 kB, reached largest contentful paint in 2.00 seconds and recorded zero layout shift. The Start button was visible at 1.16 seconds and enabled after hydration/save discovery at 3.36 seconds. Initial transfer fell about 49%; a tall viewport showing the map immediately still loads its images. Active networks retain immediate detailed imagery. These single-sample timings are directional; the regression checks instead hold JavaScript deliberately, compare control geometry before/after hydration, and verify actual image requests before/after scrolling. They cover both empty and existing save lists without changing saved worlds.

Before requesting the actual production cutover:

1. Record the exact release commit and require its full GitHub checks to pass. Review the branch publication separately from GitHub success.
2. Verify the production branch and custom-domain settings in the authorized Cloudflare account. Confirm certificate coverage for both hostnames, the `www` redirect and public indexing headers. Do not infer these settings from `wrangler.jsonc` or the branch's successful build.
3. Record the current domain routing and preserve the existing GoDaddy site and its configuration for rollback. Do not decommission the old hosting during the cutover.
4. Check the core flow on a physical phone and Safari: open the introduction, run a flight, start or import a network, advance time, download a backup and reload. Inspect legibility, touch targets and responsiveness.
5. Present the tested commit, target domain, integration sequence and rollback route for the owner's explicit approval. PR #10 remains based on `lab-electrodynamic-recovery`, stacked on draft PR #9, whose base is `main`. Check those relationships again before integration; merging may trigger a deployment.

After approval, integrate in the agreed order and deploy the tested source through the confirmed production configuration. Verify HTTPS, both hostnames, all legacy redirects, canonical URLs, public sitemap, Help, contact links and a disposable save/import on the real origin. Keep the established branch accessible and announce the backup/import path there without redirecting players away from their saved worlds.

If the release fails its entry, save or routing checks, restore the recorded previous routing or deployment while keeping the old service available. A hosting rollback does not transfer browser saves between origins; retain any new-origin backups and keep the save instructions accessible throughout recovery.
