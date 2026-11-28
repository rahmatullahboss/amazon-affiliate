/**
 * Advisory publication admission gate. CPU-only lower-bound estimate:
 * a page pre-render costs roughly one ordinary SSR; every served snapshot
 * avoids at most one SSR. D1/R2 reads, publication scheduler and invalidation
 * add costs, so a positive estimate is necessary, never sufficient.
 */
export function evaluatePublicationCpuCase({
  preregisteredUrls,
  heldoutRequests,
  heldoutCoveredRequests,
  coveredRequestCpuMs,
  observedMeanSsrCpuMs,
}) {
  for (const [key, value] of Object.entries({preregisteredUrls, heldoutRequests, heldoutCoveredRequests, coveredRequestCpuMs, observedMeanSsrCpuMs})) {
    if (!Number.isFinite(value) || value < 0) throw Error("Invalid publication assessment value: " + key);
  }
  if (heldoutCoveredRequests > heldoutRequests) throw Error("Covered requests cannot exceed total");
  const generationCpuEstimateMs = preregisteredUrls * observedMeanSsrCpuMs;
  const cpuOnlyNetEstimateMs = coveredRequestCpuMs - generationCpuEstimateMs;
  return {
    decision: preregisteredUrls === 0 || heldoutRequests === 0
      ? "INSUFFICIENT_SAMPLE"
      : cpuOnlyNetEstimateMs <= 0
        ? "HOLD_CPU_ONLY_NEGATIVE"
        : "FURTHER_D1_R2_COST_AND_FRESHNESS_QA_REQUIRED",
    measuredHeldoutCoveragePct: heldoutRequests ? 100 * heldoutCoveredRequests / heldoutRequests : null,
    generationCpuEstimateMs,
    coveredRequestCpuObservedMs: coveredRequestCpuMs,
    cpuOnlyNetEstimateMs,
    premise: "Estimated generation cost assumes one SSR per enrolled URL at sampled mean CPU. CPU-only estimate excludes D1/R2, scheduler, invalidations, deployment churn and sample bias; never auto-activates publication."
  };
}
