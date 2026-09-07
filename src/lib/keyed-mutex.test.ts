import { describe, expect, test } from "bun:test";
import { activeMutexCount, withMutex } from "./keyed-mutex";

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

describe("withLock", () => {
  test("runs calls with the same key sequentially in call order", async () => {
    const events: string[] = [];

    const first = withMutex("a", async () => {
      events.push("first:start");
      await delay(20);
      events.push("first:end");
    });
    const second = withMutex("a", async () => {
      events.push("second:start");
      await delay(5);
      events.push("second:end");
    });

    await Promise.all([first, second]);

    expect(events).toEqual([
      "first:start",
      "first:end",
      "second:start",
      "second:end",
    ]);
  });

  test("runs calls with different keys concurrently", async () => {
    const events: string[] = [];

    await Promise.all([
      withMutex("a", async () => {
        events.push("a:start");
        await delay(20);
        events.push("a:end");
      }),
      withMutex("b", async () => {
        events.push("b:start");
        await delay(5);
        events.push("b:end");
      }),
    ]);

    // "b" starts and finishes while "a" is still running.
    expect(events).toEqual(["a:start", "b:start", "b:end", "a:end"]);
  });

  test("starts the next call even when the previous one rejects", async () => {
    const first = withMutex("a", async () => {
      throw new Error("boom");
    });
    const second = withMutex("a", async () => "ok");

    await expect(first).rejects.toThrow("boom");
    await expect(second).resolves.toBe("ok");
  });

  test("passes through the resolved value", async () => {
    await expect(withMutex("a", async () => 42)).resolves.toBe(42);
  });

  test("releases the key once the queue drains", async () => {
    await Promise.all([
      withMutex("a", async () => {
        await delay(1);
      }),
      withMutex("a", async () => {
        await delay(1);
      }),
    ]);
    // Give the cleanup callback a tick to run.
    await delay(1);

    expect(activeMutexCount()).toBe(0);
  });

  test("keeps the key while calls are still queued", async () => {
    const first = withMutex("a", async () => {
      await delay(10);
    });
    const second = withMutex("a", async () => {
      await delay(1);
    });

    expect(activeMutexCount()).toBe(1);
    await Promise.all([first, second]);
    await delay(1);

    expect(activeMutexCount()).toBe(0);
  });
});
