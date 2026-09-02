import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const key = (await readFile(path.join(root, '19fea5e34e5429e2c8a76d6f1454dcc2.txt'), 'utf8')).trim();
const pages = JSON.parse(await readFile(path.join(root, 'seo/pages.json'), 'utf8'));
const keyLocation = `https://motus-robotics.github.io/${key}.txt`;
const urlList = pages.map((page) => page.canonical);

if (!/^[a-f0-9-]{8,128}$/i.test(key)) throw new Error('Invalid IndexNow key format.');
if (!urlList.length) throw new Error('No URLs found in seo/pages.json.');

if (process.env.INDEXNOW_DRY_RUN === '1') {
  console.log(`IndexNow dry run passed for ${urlList.length} canonical URLs and key location ${keyLocation}.`);
  process.exit(0);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 20_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

let keyVerified = false;
for (let attempt = 1; attempt <= 30; attempt += 1) {
  try {
    const response = await fetchWithTimeout(keyLocation, { headers: { 'user-agent': 'Motus-Robotics-SEO/1.0' } });
    if (response.ok && (await response.text()).trim() === key) {
      keyVerified = true;
      break;
    }
  } catch {
    // GitHub Pages may still be deploying; retry below.
  }
  if (attempt < 30) await new Promise((resolve) => setTimeout(resolve, 10_000));
}

if (!keyVerified) throw new Error(`IndexNow key was not available at ${keyLocation} after deployment wait.`);

const request = {
  method: 'POST',
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'user-agent': 'Motus-Robotics-SEO/1.0',
  },
  body: JSON.stringify({
    host: 'motus-robotics.github.io',
    key,
    keyLocation,
    urlList,
  }),
};

let acceptedStatus;
for (let attempt = 1; attempt <= 5; attempt += 1) {
  let response;
  try {
    response = await fetchWithTimeout('https://api.indexnow.org/indexnow', request);
  } catch (error) {
    if (attempt === 5) throw error;
    await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 1000));
    continue;
  }
  const responseText = await response.text();
  if ([200, 202].includes(response.status)) {
    acceptedStatus = response.status;
    break;
  }

  const retriable = response.status === 429 || response.status >= 500;
  if (!retriable || attempt === 5) {
    throw new Error(`IndexNow rejected the submission (${response.status}): ${responseText.slice(0, 500)}`);
  }

  const retryAfter = Number.parseInt(response.headers.get('retry-after') || '', 10);
  const delayMs = Number.isFinite(retryAfter) ? Math.min(retryAfter, 60) * 1000 : 2 ** attempt * 1000;
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

console.log(`IndexNow accepted ${urlList.length} canonical URLs (${acceptedStatus}).`);
