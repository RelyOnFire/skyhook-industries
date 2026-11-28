import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { PUBLIC_ORIGIN, PREVIEW_ORIGIN, deploymentPolicy, indexablePage } from '../src/site/deployment.mjs';

test('only the production branch or a deliberate release build enables indexing', () => {
  for (const env of [{}, { NODE_ENV: 'production' }, { CI: 'true' }, { WORKERS_CI: '1' }, { WORKERS_CI_BRANCH: 'feature/new-lab' }, { WORKERS_CI_BRANCH: 'dribbble-visual-redesign' }]) {
    assert.equal(deploymentPolicy(env).production, false);
  }
  assert.equal(deploymentPolicy({ WORKERS_CI_BRANCH: 'main' }).production, true);
  assert.equal(deploymentPolicy({ SKYHOOK_DEPLOYMENT: 'production' }).production, true);
  assert.equal(deploymentPolicy({ WORKERS_CI_BRANCH: 'main', SKYHOOK_DEPLOYMENT: 'preview' }).production, false);
  assert.equal(deploymentPolicy({ WORKERS_CI_BRANCH: 'dribbble-visual-redesign', SKYHOOK_DEPLOYMENT: 'production' }).production, false);
  assert.equal(deploymentPolicy({ WORKERS_CI: '1', SKYHOOK_DEPLOYMENT: 'production' }).production, false);
  assert.equal(deploymentPolicy({ WORKERS_CI_BRANCH: 'site-rebuild', SKYHOOK_PRODUCTION_BRANCH: 'site-rebuild' }).production, true);
  assert.equal(deploymentPolicy({ WORKERS_CI_BRANCH: 'main', SKYHOOK_PRODUCTION_BRANCH: 'site-rebuild' }).production, false);
  assert.throws(() => deploymentPolicy({ SKYHOOK_DEPLOYMENT: 'prod' }), /must be production or preview/);
  assert.equal(deploymentPolicy({ WORKERS_CI_BRANCH: 'dribbble-visual-redesign' }).shareOrigin, PREVIEW_ORIGIN);
  assert.equal(deploymentPolicy({ WORKERS_CI_BRANCH: 'dribbble-visual-redesign', SKYHOOK_DEPLOYMENT: 'production' }).shareOrigin, PREVIEW_ORIGIN);
  assert.equal(deploymentPolicy({ WORKERS_CI_BRANCH: 'main' }).shareOrigin, PUBLIC_ORIGIN);
  assert.equal(deploymentPolicy({ SKYHOOK_SHARE_ORIGIN: 'https://review.example' }).shareOrigin, 'https://review.example');
});

test('public experiences are discoverable while archive and error pages stay excluded', () => {
  for (const path of ['/', '/help/', '/lab/', '/lab/method/', '/lab/campaign/', '/lab/campaign/method/', '/lab/cardio/', '/lab/cardio/method/']) assert.ok(indexablePage(path), path);
  for (const path of ['/archive', '/archive/', '/404', '/404/', '/404.html']) assert.equal(indexablePage(path), false, path);
});

const dist = resolve(process.env.SKYHOOK_TEST_DIST || 'dist');
const deployment = deploymentPolicy();
async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => entry.isDirectory() ? filesIn(join(directory, entry.name)) : [join(directory, entry.name)]));
  return nested.flat();
}
function attribute(tag, name) {
  return tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
}
function meta(html, key, value) {
  return [...html.matchAll(/<meta\b[^>]*>/g)].map(match => match[0]).find(tag => attribute(tag, key) === value);
}

test('the library serves the five exact original PDFs from the site itself', async () => {
  const originals = {
    'hastol-cardiorotovator': '8e69a21fb506ba89b79110058653b9d80924f051efc2dfc56f932d2099610a96',
    'hastol-annual-meeting': 'e4197c9e9932fb655a58b800a2f11db4d793f48fa83b0cb81a1de51c986f9089',
    'hastol-phase-ii': 'e80890a22d788f606fb8296f97086f17cdf9d0cab994057e64782ccb12256797',
    'tethers-in-space-handbook': '3fb340678124c011f71e98b6dfcdd57d257f5f1f26d9f04043b77339b88d12bf',
    'cislunar-tether-transport': 'b5e1f6d06390fb3483b80fd70eb301ed3df2ea0f3f8a7c765dab3704b3880b0a',
  };
  const library = await readFile(join(dist, 'research/library/index.html'), 'utf8');
  for (const [id, sha256] of Object.entries(originals)) {
    const path = `/research/papers/${id}.pdf`;
    const links = [...library.matchAll(/<a\b[^>]*>/g)].map(match => match[0]).filter(tag => attribute(tag, 'href') === path);
    assert.ok(links.some(tag => /\bdownload\b/.test(tag)), `Missing download for ${id}`);
    assert.ok(library.includes(`id="${id}"`), `Missing bookmark for ${id}`);
    const bytes = await readFile(join(dist, path));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), sha256, id);
  }
});

test('built HTML and sitemap agree on preview/production policy for every route', async () => {
  const files = await filesIn(dist);
  const htmlFiles = files.filter(file => file.endsWith('.html'));
  assert.ok(htmlFiles.length >= 20, 'Build the complete site before running the launch check.');
  const indexable = [];
  for (const file of htmlFiles) {
    const html = await readFile(file, 'utf8');
    const canonicalTag = [...html.matchAll(/<link\b[^>]*>/g)].map(match => match[0]).find(tag => attribute(tag, 'rel') === 'canonical');
    assert.ok(canonicalTag, `${file}: canonical missing`);
    const canonical = new URL(attribute(canonicalTag, 'href'));
    assert.equal(canonical.origin, PUBLIC_ORIGIN, `${file}: canonical origin`);
    const allowed = indexablePage(canonical.pathname);
    const robots = meta(html, 'name', 'robots');
    if (!deployment.production || !allowed) assert.equal(attribute(robots || '', 'content'), 'noindex,follow', `${file}: must be noindex`);
    else {
      assert.equal(robots, undefined, `${file}: public page must be indexable`);
      indexable.push(canonical.href);
    }
    const share = new URL(attribute(meta(html, 'property', 'og:url') || '', 'content'));
    assert.equal(share.origin, new URL(deployment.shareOrigin).origin, `${file}: share origin`);
  }
  const sitemapFiles = files.filter(file => /sitemap-\d+\.xml$/.test(file));
  const sitemapURLs = (await Promise.all(sitemapFiles.map(file => readFile(file, 'utf8')))).flatMap(xml => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]));
  assert.deepEqual(sitemapURLs.sort(), indexable.sort(), 'Sitemap must contain exactly the indexable built routes.');
});

test('all seven retired routes and slash variants redirect to existing specific content', async () => {
  const redirects = await readFile('public/_redirects', 'utf8');
  assert.equal(await readFile(join(dist, '_redirects'), 'utf8'), redirects, 'Redirects must be included in the deployment assets.');
  const expected = new Map([
    ['/team', '/about/#founder'],
    ['/ethos', '/about/#principles'],
    ['/the-skyhook', '/system/'],
    ['/mission-proposal', '/archive/#mission-proposal'],
    ['/mission-proposal/f/high-wire-act', '/archive/#high-wire-act'],
    ['/mission-proposal/f/orbital-bridges', '/archive/#orbital-bridges'],
    ['/mission-proposal/f/a-non-synchronous-orbital-skyhook', '/archive/#non-synchronous-skyhook'],
  ]);
  const rules = redirects.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#')).map(line => line.split(/\s+/));
  assert.equal(rules.length, 14);
  assert.equal(new Set(rules.map(rule => rule[0])).size, rules.length, 'Sources must be unique.');
  for (const [source, destination, code] of rules) {
    assert.equal(expected.get(source.replace(/\/$/, '')), destination, source);
    assert.equal(code, '301', source);
    const target = new URL(destination, PUBLIC_ORIGIN);
    assert.equal(target.origin, PUBLIC_ORIGIN);
    const file = join(dist, target.pathname, 'index.html');
    assert.ok(!relative(dist, file).startsWith('..'));
    const html = await readFile(file, 'utf8');
    if (target.hash) assert.ok(html.includes(`id="${target.hash.slice(1)}"`), `${destination}: missing anchor`);
    assert.ok(!rules.some(rule => rule[0] === target.pathname), `${source}: redirect chain`);
  }
});
