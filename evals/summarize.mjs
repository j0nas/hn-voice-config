#!/usr/bin/env node
// Summarize a Promptfoo eval JSON output as a per-case pass-rate table,
// optionally grouped by provider label. Usage:
//   node evals/summarize.mjs <result.json> [<other.json> …]
//
// For multi-provider configs (temp sweep, retry sweep), shows a column
// per provider so wins/regressions are visible at a glance.

import { readFileSync } from 'node:fs';

if (process.argv.length < 3) {
  console.error('usage: node summarize.mjs <result.json> [<other.json>…]');
  process.exit(1);
}

function loadResults(path) {
  const data = JSON.parse(readFileSync(path, 'utf8'));
  // Promptfoo schema: { results: { results: [...] } } or { results: [...] }
  const results = data.results?.results ?? data.results ?? [];
  return results;
}

function caseKey(r) {
  return r.testCase?.description || r.description || r.testCase?.vars?.utterance || '<unnamed>';
}

function providerLabel(r) {
  return r.provider?.label || r.provider?.id || 'default';
}

function summarize(paths) {
  // Map<caseKey, Map<providerLabel, {pass, total}>>
  const byCase = new Map();
  const providers = new Set();

  for (const path of paths) {
    const results = loadResults(path);
    for (const r of results) {
      const k = caseKey(r);
      const p = providerLabel(r);
      providers.add(p);
      if (!byCase.has(k)) byCase.set(k, new Map());
      const inner = byCase.get(k);
      if (!inner.has(p)) inner.set(p, { pass: 0, total: 0 });
      const slot = inner.get(p);
      slot.total += 1;
      if (r.success) slot.pass += 1;
    }
  }

  const providerList = [...providers].sort();
  const caseList = [...byCase.keys()];

  // Compute column widths
  const caseWidth = Math.max(...caseList.map((c) => c.length), 'CASE'.length);
  const colWidth = (label) =>
    Math.max(label.length, ...caseList.map((c) => formatCell(byCase.get(c).get(label)).length));

  function formatCell(slot) {
    if (!slot) return '—';
    const { pass, total } = slot;
    const pct = total === 0 ? 0 : Math.round((pass / total) * 100);
    return `${pass}/${total} (${pct}%)`;
  }

  // Header
  const cols = providerList.map((p) => p.padEnd(colWidth(p)));
  console.log(`${'CASE'.padEnd(caseWidth)}  ${cols.join('  ')}`);
  console.log(`${'-'.repeat(caseWidth)}  ${providerList.map((p) => '-'.repeat(colWidth(p))).join('  ')}`);

  // Rows
  for (const k of caseList) {
    const cells = providerList.map((p) => formatCell(byCase.get(k).get(p)).padEnd(colWidth(p)));
    console.log(`${k.padEnd(caseWidth)}  ${cells.join('  ')}`);
  }

  // Totals
  console.log(`${'-'.repeat(caseWidth)}  ${providerList.map((p) => '-'.repeat(colWidth(p))).join('  ')}`);
  const totals = providerList.map((p) => {
    let pass = 0,
      total = 0;
    for (const k of caseList) {
      const s = byCase.get(k).get(p);
      if (s) {
        pass += s.pass;
        total += s.total;
      }
    }
    const pct = total === 0 ? 0 : Math.round((pass / total) * 100);
    return `${pass}/${total} (${pct}%)`;
  });
  console.log(
    `${'TOTAL'.padEnd(caseWidth)}  ${totals.map((t, i) => t.padEnd(colWidth(providerList[i]))).join('  ')}`,
  );
}

summarize(process.argv.slice(2));
