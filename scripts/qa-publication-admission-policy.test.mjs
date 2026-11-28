import test from "node:test";
import assert from "node:assert/strict";
import { evaluatePublicationCpuCase } from "./publication-admission-policy.mjs";

test("holds low prospective coverage even if cached docs can serve first visits", () => {
  const result = evaluatePublicationCpuCase({
    preregisteredUrls: 38,
    heldoutRequests: 49,
    heldoutCoveredRequests: 2,
    coveredRequestCpuMs: 161,
    observedMeanSsrCpuMs: 45.8,
  });
  assert.equal(result.decision, "HOLD_CPU_ONLY_NEGATIVE");
  assert.equal(result.generationCpuEstimateMs, 38 * 45.8);
  assert.equal(result.coveredRequestCpuObservedMs, 161);
  assert.equal(result.measuredHeldoutCoveragePct, 200 / 49);
});

test("does not grant release readiness even with favorable CPU-only assumptions", () => {
  const result = evaluatePublicationCpuCase({
    preregisteredUrls: 1,
    heldoutRequests: 50,
    heldoutCoveredRequests: 40,
    coveredRequestCpuMs: 900,
    observedMeanSsrCpuMs: 20,
  });
  assert.equal(result.decision, "FURTHER_D1_R2_COST_AND_FRESHNESS_QA_REQUIRED");
});

test("insufficient and invalid inputs are guarded", () => {
  assert.equal(evaluatePublicationCpuCase({
    preregisteredUrls: 0, heldoutRequests: 10, heldoutCoveredRequests: 0,
    coveredRequestCpuMs: 0, observedMeanSsrCpuMs: 30,
  }).decision, "INSUFFICIENT_SAMPLE");
  assert.throws(() => evaluatePublicationCpuCase({
    preregisteredUrls: 10, heldoutRequests: 2, heldoutCoveredRequests: 3,
    coveredRequestCpuMs: 30, observedMeanSsrCpuMs: 20,
  }), /Covered/);
});
