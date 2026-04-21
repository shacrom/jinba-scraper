import { fetch } from 'undici';

interface CacheEntry {
  rules: RobotsRule[];
  fetchedAt: number;
  // B6: when the robots.txt fetch failed, mark this entry so isAllowed
  // fails closed. We still cache to avoid hammering an unreachable host.
  unreachable: boolean;
}

interface RobotsRule {
  userAgent: string;
  disallow: string[];
  allow: string[];
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
// B6: short TTL for failed fetches so we retry ~every minute instead of waiting 24h.
const UNREACHABLE_TTL_MS = 60 * 1000;
const cache = new Map<string, CacheEntry>();

function parseRobots(text: string): RobotsRule[] {
  const rules: RobotsRule[] = [];
  let current: RobotsRule | null = null;

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const [field, ...valueParts] = line.split(':');
    const value = valueParts.join(':').trim();

    if (field?.toLowerCase() === 'user-agent') {
      current = { userAgent: value.toLowerCase(), disallow: [], allow: [] };
      rules.push(current);
    } else if (current) {
      if (field?.toLowerCase() === 'disallow' && value) {
        current.disallow.push(value);
      } else if (field?.toLowerCase() === 'allow' && value) {
        current.allow.push(value);
      }
    }
  }

  return rules;
}

function matchesAgent(rule: RobotsRule, ua: string): boolean {
  return rule.userAgent === '*' || ua.toLowerCase().includes(rule.userAgent);
}

function pathDisallowed(rules: RobotsRule[], path: string, ua: string): boolean {
  const applicable = rules.filter((r) => matchesAgent(r, ua));
  for (const rule of applicable) {
    for (const allow of rule.allow) {
      if (path.startsWith(allow)) return false;
    }
    for (const disallow of rule.disallow) {
      if (path.startsWith(disallow)) return true;
    }
  }
  return false;
}

async function fetchAndCache(robotsUrl: string): Promise<CacheEntry> {
  try {
    const res = await fetch(robotsUrl, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok && res.status >= 500) {
      // 5xx = server problem, treat as unreachable.
      const entry: CacheEntry = { rules: [], fetchedAt: Date.now(), unreachable: true };
      cache.set(robotsUrl, entry);
      return entry;
    }
    // 404 on robots.txt is the standard "no policy" signal — everything allowed.
    const text = res.ok ? await res.text() : '';
    const entry: CacheEntry = {
      rules: parseRobots(text),
      fetchedAt: Date.now(),
      unreachable: false,
    };
    cache.set(robotsUrl, entry);
    return entry;
  } catch {
    // B6: network failure / DNS / timeout — fail closed.
    const entry: CacheEntry = { rules: [], fetchedAt: Date.now(), unreachable: true };
    cache.set(robotsUrl, entry);
    return entry;
  }
}

async function getEntry(robotsUrl: string): Promise<CacheEntry> {
  const entry = cache.get(robotsUrl);
  if (entry) {
    const ttl = entry.unreachable ? UNREACHABLE_TTL_MS : CACHE_TTL_MS;
    if (Date.now() - entry.fetchedAt < ttl) return entry;
  }
  return fetchAndCache(robotsUrl);
}

/**
 * Returns true if the given URL path is allowed for the given UA.
 * Fetches and caches robots.txt for 24h. **Fails closed (returns false) when
 * robots.txt cannot be reached** — the scraper should back off until we can
 * verify policy. Negative cache is short (1 min) so recovery is fast.
 */
export async function isAllowed(url: string, robotsUrl: string, userAgent = '*'): Promise<boolean> {
  const entry = await getEntry(robotsUrl);
  if (entry.unreachable) return false;
  try {
    const parsed = new URL(url);
    return !pathDisallowed(entry.rules, parsed.pathname, userAgent);
  } catch {
    return true; // malformed URL — let the fetcher reject it downstream
  }
}

/** Clear the cache (for testing) */
export function clearRobotsCache(): void {
  cache.clear();
}
