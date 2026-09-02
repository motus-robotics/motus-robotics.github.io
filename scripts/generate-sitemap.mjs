import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(root, 'seo/pages.json');
const sitemapPath = path.join(root, 'sitemap.xml');
const pages = JSON.parse(await readFile(manifestPath, 'utf8'));

const escapeXml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;');

const lines = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
  '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"',
  '        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">',
];

for (const page of pages) {
  lines.push('  <url>');
  lines.push(`    <loc>${escapeXml(page.canonical)}</loc>`);
  lines.push(`    <lastmod>${escapeXml(page.lastmod)}</lastmod>`);
  lines.push(`    <changefreq>${escapeXml(page.changefreq)}</changefreq>`);
  lines.push(`    <priority>${escapeXml(page.priority)}</priority>`);

  if (page.image) {
    lines.push('    <image:image>');
    lines.push(`      <image:loc>${escapeXml(page.image.loc)}</image:loc>`);
    lines.push(`      <image:title>${escapeXml(page.image.title)}</image:title>`);
    lines.push(`      <image:caption>${escapeXml(page.image.caption)}</image:caption>`);
    lines.push('    </image:image>');
  }

  if (page.video) {
    lines.push('    <video:video>');
    lines.push(`      <video:thumbnail_loc>${escapeXml(page.video.thumbnail)}</video:thumbnail_loc>`);
    lines.push(`      <video:title>${escapeXml(page.video.title)}</video:title>`);
    lines.push(`      <video:description>${escapeXml(page.video.description)}</video:description>`);
    lines.push(`      <video:content_loc>${escapeXml(page.video.content)}</video:content_loc>`);
    lines.push(`      <video:publication_date>${escapeXml(page.video.publicationDate)}</video:publication_date>`);
    lines.push(`      <video:duration>${escapeXml(page.video.duration)}</video:duration>`);
    lines.push('      <video:family_friendly>yes</video:family_friendly>');
    lines.push('    </video:video>');
  }

  lines.push('  </url>');
}

lines.push('</urlset>');
const generated = `${lines.join('\n')}\n`;

if (process.argv.includes('--check')) {
  const current = await readFile(sitemapPath, 'utf8');
  if (current !== generated) {
    console.error('sitemap.xml is out of date. Run: node scripts/generate-sitemap.mjs');
    process.exit(1);
  }
  console.log(`sitemap.xml is current (${pages.length} canonical URLs).`);
} else {
  await writeFile(sitemapPath, generated);
  console.log(`Wrote sitemap.xml with ${pages.length} canonical URLs.`);
}
