import { describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import worker from "../../workers/app";

describe("owner-paused automatic AI blog generation", () => {
  it("does not enqueue AI generation when flag is off or absent", async () => {
    for (const value of ["off", undefined]) {
      const tasks: Promise<unknown>[] = [];
      const ctx = { waitUntil: (task: Promise<unknown>) => tasks.push(task) };
      await worker.scheduled(
        { cron: "0 * * * *" } as never,
        { ...env, BLOG_AUTO_GENERATION: value } as never,
        ctx as never
      );
      // Publication of already scheduled posts is awaited, not disabled.
      expect(tasks).toEqual([]);
    }
  });
});
