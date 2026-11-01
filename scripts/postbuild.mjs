import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const manifestPath = resolve(root, 'dist/manifest.json');
const packagePath = resolve(root, 'package.json');
const iconPath = resolve(root, 'dist/approve-icon.svg');

if (!existsSync(iconPath)) {
  throw new Error('The launcher SVG was not copied to dist');
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
const [owner, repository] = (process.env.GITHUB_REPOSITORY || 'DOCTORLOWCODING/Approve-Label').split('/');

if (!owner || !repository || !/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repository)) {
  throw new Error('Invalid GITHUB_REPOSITORY value');
}

const baseUrl = `https://${owner.toLowerCase()}.github.io/${repository}/`;
manifest.name = 'Approve Label';
manifest.version = packageJson.version;
manifest.manifest_version = 1;
delete manifest.description;
delete manifest.icon;
manifest.background_url = `${baseUrl}background.html`;
manifest.action = {
  title: 'Approve Label',
  icon: `${baseUrl}approve-icon.svg`,
  popover: `${baseUrl}index.html`,
  width: 360,
  height: 480,
};

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
