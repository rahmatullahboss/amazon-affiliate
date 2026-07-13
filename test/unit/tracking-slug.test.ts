import { describe, expect, it } from "vitest";
import { derivePublicSlugFromTrackingTag } from "../../shared/tracking-slug";

describe("tracking tag public slug", () => {
  it("removes the Amazon -20 suffix", () => {
    expect(derivePublicSlugFromTrackingTag("rahmat-agent-20")).toBe("rahmat-agent");
  });

  it("removes the Amazon -21 suffix", () => {
    expect(derivePublicSlugFromTrackingTag("Rahmat-Agent-21")).toBe("rahmat-agent");
  });

  it("accepts a pasted tag query format", () => {
    expect(derivePublicSlugFromTrackingTag("?tag=rahmat-agent-20")).toBe("rahmat-agent");
  });

  it("does not remove a non-Amazon text suffix", () => {
    expect(derivePublicSlugFromTrackingTag("rahmat-agent-us")).toBe("rahmat-agent-us");
  });
});
