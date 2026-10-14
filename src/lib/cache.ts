/**
 * Single-flight TTL cache with negative caching and LRU eviction.
 * Concurrent callers share one in-flight promise (no stampedes); 429/5xx and
 * timeout failures are cached briefly so rate-limit bans aren't hammered;
 * maps stay bounded. Dependency-free — safe anywhere.
 */

export type CacheStore<T> = {
  values: Map<string, { at: number; value: T }>;
  errors: Map<string, { at: number; message: string }>;
  pending: Map<string, Promise<T>>;
  max: number;
};

export function createCache<T>(max = 200): CacheStore<T> {
  return { values: new Map(), errors: new Map(), pending: new Map(), max };
}

function touch<K, V>(map: Map<K, V>, key: K, entry: V, max: number): void {
  map.delete(key);
  map.set(key, entry);
  while (map.size > max) {
    const oldest = map.keys().next().value;
    if (oldest === undefined) break;
    map.delete(oldest);
  }
}

export function isNegativeWorthy(message: string): boolean {
  return /(429|5\d\d|timeout|abort|unavailable|rate limit)/i.test(message);
}

/**
 * Fetch through the cache. Fresh hits return immediately; misses single-flight;
 * negative-worthy failures are cached for negativeTtlMs and rethrown.
 */
export async function fetchCached<T>(
  store: CacheStore<T>,
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
  negativeTtlMs = 20_000,
): Promise<T> {
  const now = Date.now();
  const hit = store.values.get(key);
  if (hit && now - hit.at < ttlMs) return hit.value;
  const neg = store.errors.get(key);
  if (neg && now - neg.at < negativeTtlMs) throw new Error(neg.message);
  if (neg) store.errors.delete(key);
  const inflight = store.pending.get(key);
  if (inflight) return inflight;
  const task = loader().then(
    (value) => {
      touch(store.values, key, { at: Date.now(), value }, store.max);
      store.pending.delete(key);
      return value;
    },
    (error: unknown) => {
      const message = error instanceof Error ? error.message : "Unavailable";
      if (isNegativeWorthy(message)) {
        touch(store.errors, key, { at: Date.now(), message }, store.max);
      }
      store.pending.delete(key);
      throw error;
    },
  );
  store.pending.set(key, task);
  return task;
}
