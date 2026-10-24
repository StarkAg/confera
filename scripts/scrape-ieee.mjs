#!/usr/bin/env node
/**
 * Refreshes Confera's conference data from IEEE's public conference search.
 *
 * Same two calls conferences.ieee.org makes in a browser:
 *   POST https://conference-api.ieee.org/public/searchfacet  (10 results/page, `pos` = page number)
 *   GET  https://conference-api.ieee.org/public/details?id=N (CFP deadline, fields, scope, ...)
 *
 * Writes, for every upcoming IEEE conference in COUNTRY:
 *   full.md                 -- the table src/App.tsx imports (format must not change)
 *   full_cfp.md             -- per-conference CFP report with scope
 *   cfp_deadline_missing.md -- conferences IEEE lists without a CFP deadline
 *   cfp.csv                 -- No, Conference, CFP Deadline, Field of Interest
 *   public/summary.json     -- a few headline numbers + the next deadlines, read
 *                              by the Confera card on GradeX's home page
 *
 * Refuses to overwrite anything when the result looks broken (far fewer
 * conferences than last time, or many detail fetches failing), so an API
 * hiccup can never blank the live site.
 *
 * Usage: node scripts/scrape-ieee.mjs [--dry-run]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const COUNTRY = process.env.CONFERA_COUNTRY || 'India';
const API = 'https://conference-api.ieee.org/public';
const HEADERS = {
  Origin: 'https://conferences.ieee.org',
  Referer: 'https://conferences.ieee.org/',
  'User-Agent': 'Confera (student IEEE conference explorer; https://confera.gradex.bond)',
};
const DRY_RUN = process.argv.includes('--dry-run');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withRetry(fn, label) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt >= 4) throw new Error(`${label}: ${e.message}`);
      await sleep(1500 * attempt);
    }
  }
}

async function searchPage(pos) {
  const body = new URLSearchParams({
    q: '*', subsequent_q: '', date: 'all', from: '', to: '', region: 'all', country: COUNTRY,
    pos: String(pos), sortorder: 'asc', sponsor: '', sponsor_type: 'all', state: 'all',
    field_of_interest: 'all', sortfield: 'start_date', searchmode: 'advanced',
    virtualConfReadOnly: 'B', eventformat: '',
  });
  const res = await fetch(`${API}/searchfacet`, {
    method: 'POST', headers: { ...HEADERS, 'Content-Type': 'application/x-www-form-urlencoded' }, body,
  });
  if (!res.ok) throw new Error(`search HTTP ${res.status}`);
  const entity = (await res.json())?.entity;
  if (!entity || !Array.isArray(entity.results)) throw new Error('search: unexpected response');
  return entity;
}

async function details(id) {
  const res = await fetch(`${API}/details?id=${encodeURIComponent(id)}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`details HTTP ${res.status}`);
  const detail = (await res.json())?.entity?.eventDetail;
  if (!detail?.eventId) throw new Error('details: unexpected response');
  return detail;
}

// Table cells: no pipes or newlines, or the markdown row splits wrong.
const cell = (v) => String(v ?? '').replace(/\|/g, '/').replace(/\s*\n\s*/g, ' ').trim();
const isoDate = (v) => (/^\d{4}-\d{2}-\d{2}/.test(String(v || '')) ? String(v).slice(0, 10) : '');
const csvField = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  console.log(`[confera] Searching IEEE conferences in ${COUNTRY} ...`);

  const first = await withRetry(() => searchPage(0), 'search page 0');
  const total = first.totalResults;
  const pageSize = first.pageSize || first.results.length || 10;
  const hits = [...first.results];
  // `pos` is a page number (0, 1, 2 ...), not a result offset.
  const pages = Math.ceil(total / pageSize);
  for (let pos = 1; pos < pages; pos++) {
    await sleep(400);
    const page = await withRetry(() => searchPage(pos), `search page ${pos}`);
    hits.push(...page.results);
  }
  const ids = [...new Set(hits.map((h) => h.eventId))];
  console.log(`[confera] ${total} conferences listed, ${ids.length} unique.`);

  const results = [];
  const failures = [];
  const queue = [...ids];
  async function worker() {
    while (queue.length) {
      const id = queue.shift();
      try {
        results.push(await withRetry(() => details(id), `details ${id}`));
      } catch (e) {
        failures.push(id);
        console.warn(`[confera] ${e.message}`);
      }
      await sleep(250);
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));
  console.log(`[confera] Details fetched: ${results.length}, failed: ${failures.length}.`);

  // Sanity guards before touching any file the site builds from.
  const previous = (fs.existsSync(path.join(ROOT, 'full.md'))
    ? fs.readFileSync(path.join(ROOT, 'full.md'), 'utf8').match(/^\| \d+ \|/gm) || [] : []).length;
  if (results.length < 20 || (previous && results.length < previous * 0.5)) {
    throw new Error(`Only ${results.length} conferences (had ${previous}) -- not overwriting.`);
  }
  if (failures.length > Math.max(5, ids.length * 0.1)) {
    throw new Error(`${failures.length} detail fetches failed -- not overwriting.`);
  }

  results.sort((a, b) => String(a.startDate).localeCompare(String(b.startDate))
    || String(a.eventTitle).localeCompare(String(b.eventTitle)));

  const viewUrl = (id) => `https://conferences.ieee.org/conferences_events/conferences/conferencedetails/${id}`;
  const apiUrl = (id) => `${API}/details?id=${id}`;

  // full.md -- src/App.tsx parses this table by column position.
  const md = [
    `# IEEE ${COUNTRY} Conferences`,
    '',
    `- Source: IEEE conference search via \`${API}/searchfacet\``,
    `- Enrichment source: IEEE detail endpoint via \`${API}/details?id=...\``,
    `- Country filter: \`${COUNTRY}\``,
    `- Generated on: ${today}`,
    `- Total conferences returned by API: ${total}`,
    `- Unique conferences written below: ${results.length}`,
    `- Detail fetch failures: ${failures.length}`,
    '- Sort order: conference start date ascending',
    '',
    '| # | Conference | Dates | CFP Deadline | Location | Format | Field of Interest | Sponsors | IEEE Details | API Details |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...results.map((d, i) => {
      const loc = [d.location?.city, d.location?.country].filter(Boolean).join(', ');
      const dates = [isoDate(d.startDate), isoDate(d.endDate)].filter(Boolean).join(' to ');
      return `| ${i + 1} | ${cell(d.eventTitle)} | ${cell(dates)} | ${isoDate(d.callForPapers)} | ${cell(loc)} | ${cell(d.eventFormat)} | ${cell(d.about)} | ${cell(d.sponsors)} | [view](${viewUrl(d.eventId)}) | [json](${apiUrl(d.eventId)}) |`;
    }),
    '',
  ].join('\n');

  const cfpReport = [
    '# Full CFP Report', '',
    `- Country: ${COUNTRY}`, `- Source: ${API}/searchfacet + ${API}/details`, `- Generated on: ${today}`, '',
    ...results.map((d, i) => {
      const deadline = isoDate(d.callForPapers);
      const status = !deadline ? 'missing' : deadline < today ? 'closed' : 'open';
      return [
        `## ${i + 1}. ${cell(d.eventTitle)}`,
        `- Event ID: ${d.eventId}`,
        `- CFP Deadline: ${deadline}`,
        `- CFP Status: ${status}`,
        `- Field of Interest: ${cell(d.about)}`,
        `- CFP Scope: ${cell(d.scope)}`,
        `- API Details: ${apiUrl(d.eventId)}`,
        '',
      ].join('\n');
    }),
  ].join('\n');

  const missing = results.map((d, i) => ({ d, n: i + 1 })).filter(({ d }) => !isoDate(d.callForPapers));
  const missingReport = [
    '# CFP Deadline Missing Report', '',
    `- CFP Deadline missing: ${missing.length} of ${results.length}`, `- Generated on: ${today}`, '',
    '## Conferences with Missing CFP Deadline', '',
    '| # | Conference | Field of Interest |', '| --- | --- | --- |',
    ...missing.map(({ d, n }) => `| ${n} | ${cell(d.eventTitle)} | ${cell(d.about)} |`), '',
  ].join('\n');

  const csv = [
    'No,Conference,CFP Deadline,Field of Interest',
    ...results.map((d, i) => [i + 1, csvField(d.eventTitle), csvField(isoDate(d.callForPapers)), csvField(d.about)].join(',')),
    '',
  ].join('\n');

  const open = results.filter((d) => isoDate(d.callForPapers) >= today).length;
  console.log(`[confera] ${results.length} conferences, ${open} with an open CFP, ${missing.length} without a deadline.`);
  if (DRY_RUN) { console.log('[confera] --dry-run: nothing written.'); return; }

  fs.writeFileSync(path.join(ROOT, 'full.md'), md);
  fs.writeFileSync(path.join(ROOT, 'full_cfp.md'), cfpReport);
  fs.writeFileSync(path.join(ROOT, 'cfp_deadline_missing.md'), missingReport);
  fs.writeFileSync(path.join(ROOT, 'cfp.csv'), csv);

  // Small public summary for other sites (GradeX's home card). Days-left is
  // computed by the reader from the dates, so a day-old summary stays right.
  const acronym = (title) => (String(title).match(/\(([^()]+)\)\s*$/) || [])[1] || '';
  const openList = results
    .filter((d) => isoDate(d.callForPapers) >= today)
    .sort((a, b) => isoDate(a.callForPapers).localeCompare(isoDate(b.callForPapers)));
  const summary = {
    updated: today,
    total: results.length,
    open: openList.length,
    hybridOpen: openList.filter((d) => ['hybrid', 'virtual'].includes(String(d.eventFormat).toLowerCase())).length,
    next: openList.slice(0, 12).map((d) => ({
      acronym: acronym(d.eventTitle), title: cell(d.eventTitle), city: d.location?.city || '',
      cfp: isoDate(d.callForPapers), format: d.eventFormat || '',
    })),
  };
  fs.mkdirSync(path.join(ROOT, 'public'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'public', 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
  console.log('[confera] Wrote full.md, full_cfp.md, cfp_deadline_missing.md, cfp.csv, public/summary.json.');
}

main().catch((e) => {
  console.error(`[confera] ${e.message}`);
  process.exit(1);
});
