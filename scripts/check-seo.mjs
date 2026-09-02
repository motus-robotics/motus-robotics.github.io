import { access, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const trackedFiles = new Set(
  execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean),
);

const fail = (file, message) => errors.push(`${file}: ${message}`);
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function attributes(tag) {
  return Object.fromEntries(
    [...tag.matchAll(/([:\w-]+)\s*=\s*(["'])(.*?)\2/gs)].map((match) => [match[1].toLowerCase(), match[3]]),
  );
}

function tags(html, name) {
  return [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi'))].map((match) => ({
    raw: match[0],
    attrs: attributes(match[0]),
  }));
}

function meta(html, key) {
  const expected = key.toLowerCase();
  const found = tags(html, 'meta').find(({ attrs }) =>
    attrs.name?.toLowerCase() === expected || attrs.property?.toLowerCase() === expected,
  );
  return found?.attrs.content;
}

function link(html, rel, hreflang) {
  return tags(html, 'link').find(({ attrs }) =>
    attrs.rel?.toLowerCase() === rel.toLowerCase() &&
    (!hreflang || attrs.hreflang?.toLowerCase() === hreflang.toLowerCase()),
  )?.attrs.href;
}

function textOfFirst(html, tagName) {
  const match = html.match(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)</${tagName}>`, 'i'));
  return match?.[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() ?? '';
}

async function localTargetExists(pageFile, rawTarget) {
  const target = rawTarget.split('#')[0].split('?')[0];
  if (!target || /^(?:https?:|mailto:|tel:|data:|javascript:)/i.test(target)) return true;

  let resolved;
  if (target.startsWith('/')) resolved = path.join(root, target.slice(1));
  else resolved = path.resolve(path.dirname(path.join(root, pageFile)), target);

  const candidates = [resolved];
  if (target.endsWith('/')) candidates.push(path.join(resolved, 'index.html'));
  if (!path.extname(resolved)) {
    candidates.push(`${resolved}.html`);
    candidates.push(path.join(resolved, 'index.html'));
  }

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return true;
    } catch {
      const repositoryPath = path.relative(root, candidate).split(path.sep).join('/');
      if (trackedFiles.has(repositoryPath)) return true;
    }
  }
  return false;
}

const pageSpecs = [
  {
    file: 'motus.html',
    canonical: 'https://motus-robotics.github.io/motus',
    lang: 'en',
    citationAuthors: 16,
    citationPublicationDate: '2026',
    h1Includes: 'Motus:',
  },
  {
    file: 'motus2/index.html',
    canonical: 'https://motus-robotics.github.io/motus2/',
    lang: 'en',
    citationAuthors: 19,
    citationPublicationDate: '2026/08/31',
    h1Includes: 'Motus2:',
    alternates: ['en', 'zh-cn', 'x-default'],
  },
  {
    file: 'motus2/zh/index.html',
    canonical: 'https://motus-robotics.github.io/motus2/zh/',
    lang: 'zh-cn',
    h1Includes: 'Motus2',
    alternates: ['en', 'zh-cn', 'x-default'],
  },
];

for (const spec of pageSpecs) {
  const html = await readFile(path.join(root, spec.file), 'utf8');
  const htmlLang = html.match(/<html\b[^>]*\blang=["']([^"']+)/i)?.[1]?.toLowerCase();
  const title = textOfFirst(html, 'title');
  const description = meta(html, 'description') ?? '';
  const canonical = link(html, 'canonical');
  const h1Tags = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)];

  if (htmlLang !== spec.lang) fail(spec.file, `expected html lang=${spec.lang}, found ${htmlLang || 'none'}`);
  if (!title) fail(spec.file, 'missing a non-empty title');
  if (description.length < 50 || description.length > 220) fail(spec.file, `description length ${description.length} is outside 50-220 characters`);
  if (canonical !== spec.canonical) fail(spec.file, `canonical must be ${spec.canonical}`);
  if (!meta(html, 'robots')?.toLowerCase().includes('index')) fail(spec.file, 'robots meta must permit indexing');
  if (meta(html, 'og:url') !== spec.canonical) fail(spec.file, 'og:url must equal the canonical URL');
  if (!meta(html, 'og:image')?.startsWith('https://')) fail(spec.file, 'og:image must be an absolute HTTPS URL');
  if (!meta(html, 'twitter:image')?.startsWith('https://')) fail(spec.file, 'twitter:image must be an absolute HTTPS URL');
  if (h1Tags.length !== 1) fail(spec.file, `expected exactly one h1, found ${h1Tags.length}`);
  if (!textOfFirst(html, 'h1').includes(spec.h1Includes)) fail(spec.file, `h1 must include ${spec.h1Includes}`);

  if (spec.citationAuthors) {
    const citationAuthors = tags(html, 'meta').filter(({ attrs }) => attrs.name?.toLowerCase() === 'citation_author');
    if (!meta(html, 'citation_title')) fail(spec.file, 'missing citation_title');
    if (citationAuthors.length < spec.citationAuthors) fail(spec.file, `expected at least ${spec.citationAuthors} citation_author tags, found ${citationAuthors.length}`);
    if (meta(html, 'citation_publication_date') !== spec.citationPublicationDate) fail(spec.file, `citation_publication_date must be ${spec.citationPublicationDate}`);
  }

  const citationPdfUrl = meta(html, 'citation_pdf_url');
  if (citationPdfUrl) {
    const canonicalDirectory = new URL('.', spec.canonical).href;
    const pdfDirectory = new URL('.', citationPdfUrl).href;
    if (canonicalDirectory !== pdfDirectory) fail(spec.file, 'citation_pdf_url must be in the same URL directory as the abstract page');
  }

  for (const language of spec.alternates ?? []) {
    if (!link(html, 'alternate', language)) fail(spec.file, `missing ${language} hreflang alternate`);
  }

  const jsonLdBlocks = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  if (jsonLdBlocks.length === 0) fail(spec.file, 'missing JSON-LD');
  for (const [index, block] of jsonLdBlocks.entries()) {
    try {
      JSON.parse(block[1]);
    } catch (error) {
      fail(spec.file, `JSON-LD block ${index + 1} is invalid: ${error.message}`);
    }
  }

  const ids = [...html.matchAll(/\bid=["']([^"']+)["']/gi)].map((match) => match[1]);
  const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  if (duplicateIds.length) fail(spec.file, `duplicate ids: ${duplicateIds.join(', ')}`);

  for (const { attrs } of tags(html, 'img')) {
    if (!attrs.alt?.trim()) fail(spec.file, `image ${attrs.src || '(unknown)'} is missing alt text`);
    if (!attrs.width || !attrs.height) fail(spec.file, `image ${attrs.src || '(unknown)'} is missing width/height`);
  }

  for (const video of tags(html, 'video')) {
    if ('autoplay' in video.attrs || /\sautoplay(?:\s|>)/i.test(video.raw)) fail(spec.file, 'autoplay video defeats the performance budget');
    if (video.attrs.preload === 'auto') fail(spec.file, 'video preload=auto defeats the performance budget');
  }

  const references = [...html.matchAll(/<(?:a|link|script|img|source)\b[^>]*\b(?:href|src)=["']([^"']+)["']/gi)].map((match) => match[1]);
  for (const reference of references) {
    if (!(await localTargetExists(spec.file, reference))) fail(spec.file, `broken local reference: ${reference}`);
  }
}

const sitemap = await readFile(path.join(root, 'sitemap.xml'), 'utf8');
const manifest = JSON.parse(await readFile(path.join(root, 'seo/pages.json'), 'utf8'));
const sitemapUrls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
const expectedUrls = manifest.map((page) => page.canonical);
for (const expected of expectedUrls) {
  if (!sitemapUrls.includes(expected)) fail('sitemap.xml', `missing canonical URL ${expected}`);
}
for (const url of sitemapUrls) {
  if (new URL(url).hostname !== 'motus-robotics.github.io') fail('sitemap.xml', `contains external URL ${url}`);
}
if (new Set(sitemapUrls).size !== sitemapUrls.length) fail('sitemap.xml', 'contains duplicate URLs');

const robots = await readFile(path.join(root, 'robots.txt'), 'utf8');
if (!robots.includes('Sitemap: https://motus-robotics.github.io/sitemap.xml')) fail('robots.txt', 'missing the production sitemap URL');
if (/Disallow:\s*\//i.test(robots)) fail('robots.txt', 'site-wide crawling is disallowed');

const config = await readFile(path.join(root, '_config.yml'), 'utf8');
for (const required of ['title: Motus Robotics', 'description:', 'url: https://motus-robotics.github.io']) {
  if (!config.includes(required)) fail('_config.yml', `missing ${required}`);
}

const rootPage = await readFile(path.join(root, 'index.html'), 'utf8');
for (const target of ['/motus', '/motus2/', 'arxiv.org/abs/2608.30237', 'motubrain.cn']) {
  if (!new RegExp(escapeRegExp(target), 'i').test(rootPage)) fail('index.html', `missing entity link for ${target}`);
}

const motus2Page = await readFile(path.join(root, 'motus2/index.html'), 'utf8');
for (const target of ['arxiv.org/abs/2608.30237', 'alphaxiv.org/abs/2608.30237', '/motus', 'motubrain']) {
  if (!new RegExp(escapeRegExp(target), 'i').test(motus2Page)) fail('motus2/index.html', `missing research-entity link for ${target}`);
}

if (errors.length) {
  console.error(`SEO checks failed (${errors.length}):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`SEO checks passed for ${pageSpecs.length} project pages and ${expectedUrls.length} sitemap URLs.`);
