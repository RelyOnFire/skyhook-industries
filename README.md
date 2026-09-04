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

Production build:

```bash
npm run build
```

Cloudflare deployment is configured in `wrangler.jsonc` and builds from GitHub.

## Editorial rule

Public claims are separated into four classes:

1. **Flight heritage** — measured or demonstrated in space.
2. **Prior research** — modeled or analyzed in credible aerospace literature.
3. **Skyhook study** — a present architectural choice under investigation.
4. **Open target** — a value or feature that still depends on modeling, testing, or material performance.

The website should describe the machine concretely and confidently without converting study assumptions into established specifications.

See `docs/editorial-standard.md` and `docs/reference-architecture.md`.
