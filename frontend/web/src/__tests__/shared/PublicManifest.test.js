import fs from 'fs';
import path from 'path';
import process from 'process';

const publicRoot = path.resolve(process.cwd(), 'public');
const html = new DOMParser().parseFromString(
  fs.readFileSync(path.join(publicRoot, 'index.html'), 'utf8'), 'text/html'
);
const readManifest = () => JSON.parse(fs.readFileSync(path.join(publicRoot, 'manifest.json'), 'utf8'));

test('the HTML manifest link resolves to a nonempty JSON object, not an empty placeholder', () => {
  const links = html.querySelectorAll('link[rel="manifest"]');
  expect(links).toHaveLength(1);
  expect(links[0].getAttribute('href').replace('%PUBLIC_URL%/', '')).toBe('manifest.json');
  expect(readManifest).not.toThrow();
  const manifest = readManifest();
  expect(manifest).not.toBeNull();
  expect(Array.isArray(manifest)).toBe(false);
  expect(Object.keys(manifest).length).toBeGreaterThan(0);
});

test('manifest identity matches the page metadata without enabling an app-only display mode', () => {
  const manifest = readManifest();
  expect(manifest.name).toBe(html.title);
  expect(manifest.lang).toBe(html.documentElement.lang);
  expect(manifest.theme_color).toBe(html.querySelector('meta[name="theme-color"]').content);
  expect(manifest.display).toBe('browser');
});

test.each(['/', '/family/'])('manifest entry stays within its same-origin mount %s without identity data', mount => {
  const manifest = readManifest();
  const base = new URL(`${mount}manifest.json`, 'https://synthetic.invalid');
  const start = new URL(manifest.start_url, base);
  const scope = new URL(manifest.scope, base);
  for (const url of [start, scope]) {
    expect(url.origin).toBe(base.origin);
    expect(url.pathname).toBe(mount);
    expect(url.search).toBe('');
    expect(url.hash).toBe('');
    expect(url.username).toBe('');
    expect(url.password).toBe('');
  }
  // Do not add missing placeholder icons or private/remote resources to the manifest.
  for (const icon of manifest.icons || []) {
    const url = new URL(icon.src, base);
    expect(url.origin).toBe(base.origin);
    expect(url.pathname.startsWith(mount)).toBe(true);
    expect(fs.statSync(path.join(publicRoot, url.pathname.slice(mount.length))).size).toBeGreaterThan(0);
  }
});
