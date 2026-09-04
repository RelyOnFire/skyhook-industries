# Skyhook Industries

Public website for **Skyhook Industries**, an independent engineering project investigating rotating orbital tethers and reusable momentum-exchange infrastructure.

## Stack

- Astro
- Static output
- Cloudflare Workers with Static Assets for deployment
- GitHub for version control and technical documentation

Production deployments are built from the `main` branch with `npm run build` and deployed from `dist` through Wrangler.

## Local development

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

## Editorial principle

> Established physics. Unsolved engineering. Enormous potential.

Public claims should distinguish flight heritage, prior research, Skyhook design direction, and open design targets.

See `docs/editorial-standard.md` and `docs/reference-architecture.md`.
