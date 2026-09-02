import { readFile } from 'node:fs/promises';

const reportPaths = process.argv.slice(2);
if (reportPaths.length === 0) {
  console.error('Usage: node scripts/check-lighthouse-budget.mjs <report.json> [report.json ...]');
  process.exit(2);
}

const reports = await Promise.all(
  reportPaths.map(async (reportPath) => JSON.parse(await readFile(reportPath, 'utf8'))),
);

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[midpoint] : (sorted[midpoint - 1] + sorted[midpoint]) / 2;
}

function category(name) {
  const values = reports.map((report) => report.categories?.[name]?.score ?? Number.NaN);
  return values.every(Number.isFinite) ? median(values) : Number.NaN;
}

function audit(name) {
  const values = reports.map((report) => report.audits?.[name]?.numericValue ?? Number.NaN);
  return values.every(Number.isFinite) ? median(values) : Number.NaN;
}

const measurements = {
  performance: category('performance'),
  accessibility: category('accessibility'),
  bestPractices: category('best-practices'),
  seo: category('seo'),
  fcpMs: audit('first-contentful-paint'),
  lcpMs: audit('largest-contentful-paint'),
  tbtMs: audit('total-blocking-time'),
  cls: audit('cumulative-layout-shift'),
  bytes: audit('total-byte-weight'),
};

const budgets = {
  performance: { minimum: 0.9, label: 'performance score' },
  accessibility: { minimum: 1, label: 'accessibility score' },
  bestPractices: { minimum: 1, label: 'best-practices score' },
  // The live SEO monitor separately validates robots.txt and canonical markers.
  // Allow Lighthouse's transient robots fetch timeout while still catching larger regressions.
  seo: { minimum: 0.9, label: 'SEO score' },
  fcpMs: { maximum: 2500, label: 'FCP' },
  lcpMs: { maximum: 3500, label: 'LCP' },
  tbtMs: { maximum: 200, label: 'TBT' },
  cls: { maximum: 0.1, label: 'CLS' },
  bytes: { maximum: 512000, label: 'initial transfer size' },
};

const failures = [];
for (const [key, budget] of Object.entries(budgets)) {
  const value = measurements[key];
  if (!Number.isFinite(value)) {
    failures.push(`${budget.label} is missing from one or more Lighthouse reports`);
  } else if (budget.minimum !== undefined && value < budget.minimum) {
    failures.push(`${budget.label} ${value} is below ${budget.minimum}`);
  } else if (budget.maximum !== undefined && value > budget.maximum) {
    failures.push(`${budget.label} ${value} exceeds ${budget.maximum}`);
  }
}

console.log(`Lighthouse mobile median across ${reports.length} run(s):`);
console.log(`- Performance: ${Math.round(measurements.performance * 100)}`);
console.log(`- Accessibility: ${Math.round(measurements.accessibility * 100)}`);
console.log(`- Best practices: ${Math.round(measurements.bestPractices * 100)}`);
console.log(`- SEO: ${Math.round(measurements.seo * 100)}`);
console.log(`- FCP: ${Math.round(measurements.fcpMs)} ms`);
console.log(`- LCP: ${Math.round(measurements.lcpMs)} ms`);
console.log(`- TBT: ${Math.round(measurements.tbtMs)} ms`);
console.log(`- CLS: ${measurements.cls.toFixed(3)}`);
console.log(`- Initial transfer: ${Math.round(measurements.bytes / 1024)} KiB`);

if (failures.length > 0) {
  console.error(`Web-quality budget failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Web-quality budget passed.');
