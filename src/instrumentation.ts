import type { Instrumentation } from "next";

/**
 * Server observability hooks. PostHog product analytics already exists for
 * product events; this wires Next.js request failures into the same pipeline
 * via `reportServerError` so we notice production crashes without a separate
 * APM product for MVP.
 */
export async function register() {
  // Reserved for future OpenTelemetry / boot-time wiring.
}

export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context,
) => {
  const { reportServerError } =
    await import("@/lib/observability/report-error");
  await reportServerError(err, {
    path: request.path,
    method: request.method,
    routerKind: context.routerKind,
    routePath: context.routePath,
    routeType: context.routeType,
  });
};
