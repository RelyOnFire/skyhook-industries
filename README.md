# Skyhook Industries

Public website and technical working documents for **Skyhook Industries**, an independent engineering project investigating rotating orbital tethers and reusable momentum-exchange transportation.

## Stack

- Astro static output
- Cloudflare Workers Static Assets
- GitHub for version control and technical documentation
- GitHub Actions build validation

## Local development

```bash
npm install
npm run dev
```

Production build for local release checks:

```bash
SKYHOOK_DEPLOYMENT=production npm run build
SKYHOOK_DEPLOYMENT=production node --test tests/site-launch.test.mjs
```

Ordinary local builds default to preview indexing. Workers builds identify the
production branch separately; see the launch checklist before configuring it.

Cloudflare deployment is configured in `wrangler.jsonc` and builds from GitHub.

## Expeditions

`/lab/campaign/` is a persistent Earth–Moon–Phobos–Mercury–Ceres logistics campaign:
build a lunar lunavator and Phobos anchor hub, produce material and equipment,
schedule direct Moon–Phobos deliveries, then unlock Mercury industry and launch
mirrors into a growing solar swarm. Reinvest its power automatically, then use
Phobos to supply Ceres and return water for support propellant. Expand industrial
capacity, open additional finite mining tracts, and protect fuel for cargo as the
swarm grows. Twenty-four milestones span six chapters. Run the clock and resume
named saves; valid schema 1–10 saves
migrate without resetting progress. Cargo supports 256 concurrent flights; solar
deployments have a separate 128-batch allowance, keeping swarm growth from
crowding out supply lines. `/lab/campaign/method/` documents the calculations,
game assumptions and save behavior. See `docs/tether-lab/campaign.md` for the
model, persistence format and validation. Flight Studio offers separate Earth
(`/lab/`), lunar (`/lab/lunar/`), Phobos anchored (`/lab/phobos/`) and T4
compound-rotor (`/lab/t4/`) experiments, plus the synchronized CardioRotovator
reference and passive experiment (`/lab/cardio/`).
The Moon and Phobos outposts link to their experiments without changing campaign
progress. See `docs/tether-lab/lunar-flight-studio.md` and
`docs/tether-lab/phobos-flight-studio.md` and `docs/tether-lab/t4-flight-studio.md`
for the models, tests and limits.

Freight contracts turn spare transport capacity into earned credits. Three buyers
post changing procurement rounds; two independent carriers reserve some of the
available work. Up to three player orders can run together, one per buyer, with
locked terms and separate cargo assignments. Current campaign state uses
`network-0.10.0`; existing saves migrate without past market activity.

## Preparing the public launch

The live domain still serves the original site. The current review branch remains
`dribbble-visual-redesign`; publishing that branch does not authorize a production
cutover. See [the launch checklist](docs/production-launch.md) for redirects,
indexing, save transfer, validation and rollback.

Visitors can use [Help & saves](src/pages/help.astro) to back up networks and designs. The
[original introduction film](docs/storyboards/skyhook-introduction.md)
runs 95 seconds, with George’s selected narration, Earth aircraft and lunar mass-driver scenes,
captions, a transcript and a deliberate-play homepage player. Its regeneration scripts and voice provenance
are documented alongside the shot plan.

## Editorial rule

Public claims are separated into four classes:

1. **Flight heritage** — measured or demonstrated in space.
2. **Prior research** — modeled or analyzed in credible aerospace literature.
3. **Skyhook study** — a present architectural choice under investigation.
4. **Open target** — a value or feature that still depends on modeling, testing, or material performance.

The website should describe the machine concretely and confidently without converting study assumptions into established specifications.

## Design rule

The current site deliberately combines cinematic orbital scale with aerospace-program documentation. Future redesigns should preserve that identity unless the visual direction is explicitly reopened.

See:

- `docs/editorial-standard.md`
- `docs/reference-architecture.md`
- `docs/visual-standard.md`
- `docs/design-audit-taste-skills.md`
