import { describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import worker from "../../workers/app";

describe("publication default-off release isolation", () => {
  it("keeps the ordinary migration ledger free of pilot schema and triggers", async () => {
    const schema = async () => (await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE name LIKE 'public_render_%' ORDER BY name"
    ).all()).results;
    expect(await schema()).toEqual([]);
    // No publication flag, bucket or version binding. The optional scheduler
    // must return without touching an unadmitted schema.
    const ctx = { waitUntil: () => { throw Error("Unexpected publication task"); } } as never;
    const dormant = { DB: env.DB } as never;
    await worker.scheduled({ cron: "*/5 * * * *" } as never, dormant, ctx);
    expect(await schema()).toEqual([]);
    // A partially configured deployment also remains dormant.
    await worker.scheduled({ cron: "*/5 * * * *" } as never, { DB: env.DB, PUBLIC_RENDER_PUBLICATION: "on" } as never, ctx);
    expect(await schema()).toEqual([]);
  });
});
