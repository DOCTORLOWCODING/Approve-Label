import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync(new URL('../public/manifest.json', import.meta.url), 'utf8'));
const base = 'https://doctorlowcoding.github.io/Approve-Label/';
const iconPath = new URL('../public/approve-icon.svg', import.meta.url);

test('extension release version is 1.0.0', () => {
  assert.equal(manifest.version, '1.0.0');
});

test('manifest uses the requested extension name', () => {
  assert.equal(manifest.name, 'Approve Label');
  assert.equal(manifest.action.title, 'Approve Label');
});

test('install-card description and icon are omitted', () => {
  assert.equal(Object.hasOwn(manifest, 'description'), false);
  assert.equal(Object.hasOwn(manifest, 'icon'), false);
});

test('room action points to the single white SVG icon', () => {
  assert.equal(manifest.action.icon, `${base}approve-icon.svg`);
});

test('white SVG icon exists and has a transparent background', () => {
  assert.equal(existsSync(iconPath), true);
  const svg = readFileSync(iconPath, 'utf8');
  assert.match(svg, /^<svg\s/);
  assert.match(svg, /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /width="64"\s+height="64"\s+viewBox="0 0 64 64"/);
  assert.match(svg, /stroke="#FFFFFF"/);
  assert.doesNotMatch(svg, /<rect\b|<image\b|linearGradient|radialGradient/i);
});


test('all extension URLs use the current repository path', () => {
  assert.equal(manifest.background_url, `${base}background.html`);
  assert.equal(manifest.action.popover, `${base}index.html`);
});

test('manifest keeps Owlbear manifest version 1', () => {
  assert.equal(manifest.manifest_version, 1);
});
