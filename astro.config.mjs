import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import { PUBLIC_ORIGIN, deploymentPolicy, indexablePage } from './src/site/deployment.mjs';

const deployment = deploymentPolicy();

export default defineConfig({
  site: PUBLIC_ORIGIN,
  output: 'static',
  integrations: [sitemap({ filter: (page) => deployment.production && indexablePage(new URL(page).pathname) }), react()],
});
