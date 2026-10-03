export const PUBLIC_ORIGIN = 'https://skyhook-industries.com';
export const PREVIEW_ORIGIN = 'https://dribbble-visual-redesign-skyhook-industries.imattoo.workers.dev';

// Workers injects WORKERS_CI_BRANCH during its build, not at request time.
// https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
// Unknown/manual builds default to preview. A deliberate manual release can use
// SKYHOOK_DEPLOYMENT=production; NODE_ENV=production is only a bundler setting.
// On Workers, the branch must match SKYHOOK_PRODUCTION_BRANCH (default main).
// An inherited production flag must never enable indexing on another branch.
export function deploymentPolicy(env = process.env) {
  const explicit = env.SKYHOOK_DEPLOYMENT?.trim();
  if (explicit && explicit !== 'production' && explicit !== 'preview') {
    throw new Error('SKYHOOK_DEPLOYMENT must be production or preview.');
  }
  const branch = env.WORKERS_CI_BRANCH?.trim();
  const productionBranch = env.SKYHOOK_PRODUCTION_BRANCH?.trim() || 'main';
  const workersBuild = Boolean(env.WORKERS_CI || branch);
  const production = explicit !== 'preview' && (workersBuild ? branch === productionBranch : explicit === 'production');
  const shareOrigin = env.SKYHOOK_SHARE_ORIGIN || (branch === 'dribbble-visual-redesign' ? PREVIEW_ORIGIN : PUBLIC_ORIGIN);
  return { production, shareOrigin };
}

export function indexablePage(pathname) {
  return !['/404', '/404/', '/404.html', '/archive', '/archive/'].includes(pathname);
}
