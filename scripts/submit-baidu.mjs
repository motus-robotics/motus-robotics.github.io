import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const token = process.env.BAIDU_PUSH_TOKEN?.trim();
const site = process.env.BAIDU_SITE?.trim() || 'https://motus-robotics.github.io';
const pages = JSON.parse(await readFile(path.join(root, 'seo/pages.json'), 'utf8'));
const urlList = pages.map((page) => page.canonical);

if (!token) throw new Error('BAIDU_PUSH_TOKEN is not configured.');
if (!urlList.length) throw new Error('No URLs found in seo/pages.json.');
if (new URL(site).origin !== site) throw new Error('BAIDU_SITE must be an origin without a path.');

if (process.env.BAIDU_DRY_RUN === '1') {
  console.log(`Baidu dry run passed for ${urlList.length} canonical URLs and site ${site}.`);
  process.exit(0);
}

// Baidu's URL submission API is currently exposed on this documented HTTP endpoint.
const endpoint = new URL('http://data.zz.baidu.com/urls');
endpoint.searchParams.set('site', site);
endpoint.searchParams.set('token', token);

let acceptedPayload;
for (let attempt = 1; attempt <= 5; attempt += 1) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'user-agent': 'Motus-Robotics-SEO/1.0',
      },
      body: `${urlList.join('\n')}\n`,
      signal: controller.signal,
    });
  } catch (error) {
    if (attempt === 5) throw error;
    await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 1000));
    continue;
  } finally {
    clearTimeout(timeout);
  }

  const responseText = await response.text();
  let payload;
  try {
    payload = JSON.parse(responseText);
  } catch {
    payload = { raw: responseText.slice(0, 500) };
  }

  if (response.ok && !payload.error) {
    acceptedPayload = payload;
    break;
  }

  const retriable = response.status === 429 || response.status >= 500;
  if (!retriable || attempt === 5) {
    throw new Error(`Baidu URL submission failed (${response.status}): ${JSON.stringify(payload)}`);
  }

  const retryAfter = Number.parseInt(response.headers.get('retry-after') || '', 10);
  const delayMs = Number.isFinite(retryAfter) ? Math.min(retryAfter, 60) * 1000 : 2 ** attempt * 1000;
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

console.log(`Baidu accepted the URL submission: ${JSON.stringify(acceptedPayload)}`);
