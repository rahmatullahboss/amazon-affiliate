/**
 * Cache only the handler derived from an immutable production build.
 * Each invocation still receives its own request and load context.
 * Don't retain a request, response, context, or an in-flight promise.
 */
export function createImmutableBuildHandler<TBuild, TArgs extends unknown[], TResult>(
  loadBuild: () => Promise<TBuild>,
  createHandler: (build: TBuild) => (...args: TArgs) => Promise<TResult>,
): (...args: TArgs) => Promise<TResult> {
  let handler: ((...args: TArgs) => Promise<TResult>) | undefined;
  return async (...args: TArgs) => {
    if (!handler) {
      const build = await loadBuild();
      // Concurrent initialization may load the same module, but only one
      // synchronous handler factory is committed to the isolate.
      handler ??= createHandler(build);
    }
    return await handler(...args);
  };
}
