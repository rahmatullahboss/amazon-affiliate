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
  let initialization: Promise<(...args: TArgs) => Promise<TResult>> | undefined;
  return async (...args: TArgs) => {
    if (!handler) {
      // Share only immutable build/handler initialization. Every request still
      // runs independently with its own args, context and response.
      const pending = initialization ??= loadBuild().then(createHandler);
      try {
        handler ??= await pending;
      } catch (error) {
        // A transient import/build failure must not poison this isolate.
        if (initialization === pending) initialization = undefined;
        throw error;
      }
      if (initialization === pending) initialization = undefined;
    }
    return await handler(...args);
  };
}
