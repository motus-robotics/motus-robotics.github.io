const base = process.env.SITE_BASE_URL?.replace(/\/$/, '') || 'https://motus-robotics.github.io';
const attempts = Number.parseInt(process.env.LIVE_SEO_ATTEMPTS || '6', 10);
const checks = [
  { path: '/', canonical: 'https://motus-robotics.github.io/', contains: 'Motus Robotics' },
  { path: '/motus', canonical: 'https://motus-robotics.github.io/motus', contains: 'Motus: A Unified Latent Action World Model' },
  { path: '/motus2/', canonical: 'https://motus-robotics.github.io/motus2/', contains: 'Motus2: A Self-Evolving General World Model' },
  { path: '/motus2/zh/', canonical: 'https://motus-robotics.github.io/motus2/zh/', contains: 'Motus2：面向灵巧操作的自进化通用世界模型' },
  { path: '/robots.txt', contains: 'Sitemap: https://motus-robotics.github.io/sitemap.xml' },
  { path: '/sitemap.xml', contains: 'https://motus-robotics.github.io/motus2/zh/' },
  { path: '/19fea5e34e5429e2c8a76d6f1454dcc2.txt', contains: '19fea5e34e5429e2c8a76d6f1454dcc2' },
];

const failures = [];

function canonicalFrom(html) {
  const links = [...html.matchAll(/<link\b[^>]*>/gi)];
  for (const [tag] of links) {
    const rel = tag.match(/\brel=["']([^"']+)["']/i)?.[1]?.toLowerCase().split(/\s+/) ?? [];
    if (!rel.includes('canonical')) continue;
    return tag.match(/\bhref=["']([^"']+)["']/i)?.[1];
  }
  return undefined;
}

async function inspect(check) {
  const url = `${base}${check.path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      headers: { 'user-agent': 'Motus-Robotics-SEO-Monitor/1.0' },
      signal: controller.signal,
    });
    const body = await response.text();
    if (!response.ok) return `${url} returned ${response.status}`;
    if (!body.includes(check.contains)) return `${url} is missing its expected SEO marker`;
    if (check.canonical && canonicalFrom(body) !== check.canonical) {
      return `${url} has an incorrect or missing canonical link`;
    }
    return undefined;
  } catch (error) {
    return `${url} failed: ${error.message}`;
  } finally {
    clearTimeout(timeout);
  }
}

for (const check of checks) {
  let failure;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    failure = await inspect(check);
    if (!failure) break;
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
  if (failure) failures.push(failure);
}

if (failures.length) {
  console.error(`Live SEO checks failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Live SEO checks passed for ${checks.length} production resources.`);
