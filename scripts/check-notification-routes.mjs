#!/usr/bin/env node
/**
 * Notification route gate — `npm run check:notification-routes`.
 *
 * Self-consistency check on lib/notifications/destinations.ts: every page
 * PAGE_BY_CODE points a notification at must be a real NavPageId (a typo'd
 * page id would type-check fine as a bare string literal in a
 * `Record<string, NavPageId>` only until the compiler catches it — this
 * catches it explicitly and says which code is affected), and every
 * TAB_BY_CODE entry must belong to a code that actually has a page — a tab
 * override with no page mapping is dead code, most likely left behind by a
 * code that got renamed or removed from PAGE_BY_CODE without its tab entry.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DESTINATIONS = join(HERE, '..', 'lib', 'notifications', 'destinations.ts');
const NAVIGATION = join(HERE, '..', 'lib', 'command', 'navigation.ts');

function parseObjectLiteral(source, marker, file) {
  const declStart = source.indexOf(marker);
  if (declStart === -1) throw new Error(`"${marker}" not found in ${file}`);
  const braceStart = source.indexOf('{', declStart);
  let depth = 0;
  for (let i = braceStart; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}' && (depth -= 1) === 0) {
      return source.slice(braceStart, i + 1);
    }
  }
  throw new Error(`unterminated object literal for "${marker}" in ${file}`);
}

function extractCodeToValue(body) {
  const pairs = [...body.matchAll(/(?:'([^']+)'|"([^"]+)"|(\w+)):\s*"([^"]+)"/g)];
  return new Map(pairs.map((m) => [m[1] ?? m[2] ?? m[3], m[4]]));
}

const navSource = readFileSync(NAVIGATION, 'utf8');
const navBlockStart = navSource.indexOf('export type NavPageId =');
const navBlockEnd = navSource.indexOf(';', navBlockStart);
const validPageIds = new Set(
  [...navSource.slice(navBlockStart, navBlockEnd).matchAll(/"([^"]+)"/g)].map((m) => m[1]),
);

const destSource = readFileSync(DESTINATIONS, 'utf8');
const pageByCode = extractCodeToValue(
  parseObjectLiteral(destSource, 'const PAGE_BY_CODE', DESTINATIONS),
);
const tabByCode = extractCodeToValue(
  parseObjectLiteral(destSource, 'const TAB_BY_CODE', DESTINATIONS),
);

const failures = [];

for (const [code, pageId] of pageByCode) {
  if (!validPageIds.has(pageId)) {
    failures.push(`${code} points at "${pageId}", which isn't a NavPageId (lib/command/navigation.ts).`);
  }
}

for (const code of tabByCode.keys()) {
  if (!pageByCode.has(code)) {
    failures.push(`${code} has a TAB_BY_CODE entry but no PAGE_BY_CODE entry — the tab has nothing to attach to.`);
  }
}

if (failures.length) {
  console.error(`\n✗ ${failures.length} notification-routing issue(s):\n`);
  for (const f of failures) console.error(`  - ${f}`);
  console.error('\nSee lib/notifications/destinations.ts.\n');
  process.exit(1);
}

console.log(`✓ ${pageByCode.size} routed code(s), ${tabByCode.size} tab override(s) — all valid, all attached.`);
