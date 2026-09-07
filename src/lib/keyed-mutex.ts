/**
 * In-process keyed async mutex.
 *
 * Chains one promise per key so that every `withLock` call for the same key
 * runs only after the previous call for that key has settled (successfully
 * or not). Different keys run concurrently. Entries are removed once the
 * last queued call for a key settles, so the map does not grow unboundedly.
 *
 * This only synchronizes within a single process; it is not a distributed
 * lock. It must not be relied upon if the service ever runs more than one
 * instance.
 */
const tails = new Map<string, Promise<unknown>>();

function noop() {}

/**
 * Number of keys that currently have a call queued or running.
 * Exposed for tests and diagnostics.
 */
export function activeMutexCount(): number {
  return tails.size;
}

/**
 * Run `fn` while holding the lock for `key`.
 * Concurrent calls with the same key run in the order they were made.
 * The returned promise adopts `fn`'s resolution or rejection.
 */
export function withMutex<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = tails.get(key) ?? Promise.resolve();
  const result = previous.then(fn, fn);

  const tail: Promise<unknown> = result
    .finally(() => {
      if (tails.get(key) === tail) {
        tails.delete(key);
      }
    })
    .catch(noop);
  tails.set(key, tail);

  return result;
}
