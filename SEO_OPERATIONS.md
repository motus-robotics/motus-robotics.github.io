# Motus Robotics SEO operations

This repository treats search visibility as a measured publishing workflow, not as
keyword stuffing or manufactured traffic. The controllable goal is to make the
canonical Motus and Motus2 resources easy to crawl, understand, cite, and revisit.

## Search baseline — 2026-09-02

- **Motus2:** a China-region Bing sample placed the arXiv PDF around position 3 for
  the exact term. The project page was not in the first 10. Older bioinformatics
  results for `mOTUs2` dominated the page. A Baidu sample did not show the official
  project page in its first result set.
- **Motus:** a China-region Bing sample placed the arXiv abstract, project page, and
  code repository at positions 1–3. This is already a strong entity cluster, though
  the generic word is geographically ambiguous.
- **Motu:** this is not an official model name and is dominated by the long-established
  MOTU audio brand and unrelated meanings. Track it as a possible truncation, not as
  a primary head term.
- **MotuBrain:** search intent is navigational and correctly favors MotuBrain's own
  arXiv, website, and repository. Motus2 should rank for truthful relationship queries
  such as `Motus2 vs MotuBrain`, not displace the official MotuBrain resources.

Rank samples are volatile and location dependent. Google Search Console, Bing
Webmaster Tools, and Baidu Search Resource Platform are the authoritative sources for
ongoing impressions, clicks, CTR, and average position.

## What is automated

- `scripts/check-seo.mjs` validates titles, descriptions, canonical URLs, hreflang,
  Open Graph and Twitter metadata, scholarly citation tags, JSON-LD, headings, image
  dimensions and alt text, duplicate IDs, internal references, robots, and sitemap.
- `seo/pages.json` is the canonical URL manifest.
- `scripts/generate-sitemap.mjs` generates `sitemap.xml`; CI fails when the checked-in
  sitemap and manifest diverge.
- `scripts/submit-indexnow.mjs` notifies Bing and other IndexNow participants only
  after GitHub Pages reports a successful production deployment and the live-page
  checks pass. Its public verification key is intentionally committed at the
  repository root.
- `scripts/submit-baidu.mjs` sends the same canonical URLs to Baidu when the repository
  secret `BAIDU_PUSH_TOKEN` is configured.
- `scripts/check-live-seo.mjs` verifies the deployed pages, canonical markers, robots,
  sitemap, Chinese page, and IndexNow key every day.

Run the local checks before publishing:

```bash
node scripts/generate-sitemap.mjs --check
node scripts/check-seo.mjs
```

When a canonical page changes, update its `lastmod` in `seo/pages.json`, then run:

```bash
node scripts/generate-sitemap.mjs
```

## One-time webmaster setup

### Google Search Console

1. Add the URL-prefix property `https://motus-robotics.github.io/`.
2. Choose HTML-file verification, add Google's verification file at the repository
   root, publish it, and finish verification.
3. Submit `https://motus-robotics.github.io/sitemap.xml` in Sitemaps.
4. Inspect `/motus2/`, `/motus2/zh/`, and `/motus`; request indexing once after this
   release. Do not use Google's Indexing API for these pages: it is intended for job
   postings and livestream pages, not research project pages.

### Bing Webmaster Tools

1. Import the verified Search Console property or verify the site directly.
2. Submit the same sitemap and confirm that IndexNow sees the public key file.
3. Monitor canonical selection and crawl errors. DuckDuckGo relies substantially on
   Bing's index, so this also improves coverage beyond Bing itself.

### Baidu Search Resource Platform

1. Add and verify `https://motus-robotics.github.io` with the HTML-file method.
2. Submit the root sitemap in the ordinary-inclusion section.
3. Copy the API push token into the GitHub Actions secret `BAIDU_PUSH_TOKEN`. The
   `Notify search engines` workflow will then submit canonical URLs after each relevant
   production update.
4. Keep `/motus2/zh/` substantive and current. Do not duplicate the same Chinese copy
   across low-quality third-party sites.

Baidu currently documents and serves URL API submission on an HTTP endpoint. The token
is limited to URL pushing, but organizations that prohibit sending any token over HTTP
should leave `BAIDU_PUSH_TOKEN` unset and submit through the authenticated Baidu console
instead; the workflow skips Baidu cleanly when the secret is absent.

Verification files and API tokens are site-specific. Never commit Baidu's API token or
Google credentials to this public repository.

## arXiv and alphaXiv

The project site cannot alter arXiv or alphaXiv metadata through its sitemap. Keep the
paper title, author order, arXiv identifier, and project URL identical across all
surfaces. On the next author-submitted arXiv revision, add this to the arXiv Comments
field so it appears on the high-authority abstract page:

`Project page: https://motus-robotics.github.io/motus2/`

The arXiv HTML rendering already contains a followed project-page link from the paper.
Also add the same canonical project link to the code README, model card, author pages,
institutional lab pages, and any official release article. These editorial links are
more valuable than bulk directory submissions.

The English project pages expose accurate title, author, and publication metadata, but
they intentionally do not claim an external arXiv/CVF PDF through `citation_pdf_url`.
Google Scholar requires that field to point to a PDF in the same URL directory as the
HTML abstract. arXiv and CVF remain the compliant scholarly full-text versions; the
Chinese overview does not duplicate their Highwire metadata.

## Query groups and measurement

Measure 28-day and 90-day trends, segmented by engine, country, device, and page:

- Navigation/resources: `Motus2`, `Motus2 paper`, `Motus2 arXiv`, `Motus2 code`,
  `Motus2 model`, `Motus2 demo`, `arXiv 2608.30237`.
- Technical discovery: `Motus2 general world model`, `Motus2 dexterous manipulation`,
  `Motus2 MBRL`, `Motus2 working memory`, `Motus2 tactile sensing`, `Motus latent
  action world model`.
- Chinese: `Motus2 通用世界模型`, `Motus2 具身智能`, `Motus2 灵巧操作`, `Motus2
  自进化机器人`, `Motus 潜动作世界模型`.
- Relationship: `Motus vs Motus2`, `Motus2 vs MotuBrain`, `Motus MotuBrain Motus2
  relationship`.

Primary KPIs are indexed canonical pages, impressions, non-branded discovery queries,
clicks to official resources, referring research domains, and query-level average
position. Do not optimize around a single personalized rank check.

## Next content releases

1. Publish code and model pages as soon as the artifacts are real; update disabled
   buttons and the sitemap in the same release.
2. Turn the existing demo selector into crawlable task detail pages or sections with
   stable anchors, captions, embodiment, capability, and a short transcript.
3. Publish one factual research-lineage page comparing Motus, MotuBrain, and Motus2,
   citing their primary papers and clearly labeling them as separate projects.
4. Add official institutional and author-page links to the project page. Avoid paid
   link networks, automated comments, copied press releases, click bots, and hidden
   keyword variants.

Useful primary documentation:

- [Google sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Google canonical guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- [Google Scholar inclusion guidance](https://scholar.google.com/intl/en/scholar/inclusion.html)
- [IndexNow protocol](https://www.indexnow.org/documentation)
