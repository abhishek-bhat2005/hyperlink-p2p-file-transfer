import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * FINDING-029: Health check endpoint for the web application.
 * Allows load balancers, uptime monitors, and Kubernetes readiness probes
 * to verify the app is running without touching any external services.
 *
 * Query params:
 * - deep=true: Performs deep health check including Supabase connectivity
 *
 * Note: No API versioning (e.g., /api/v1/) is currently implemented.
 * The API surface is small and stable. Consider adding versioning if the API
 * grows significantly or requires breaking changes.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const deep = searchParams.get("deep") === "true";

  const health: {
    status: "ok" | "degraded" | "error";
    service: string;
    timestamp: string;
    checks?: {
      supabase?: { status: "ok" | "error"; message?: string };
    };
  } = {
    status: "ok",
    service: "HyperLink Web",
    timestamp: new Date().toISOString(),
  };

  if (deep) {
    health.checks = {};

    // Check Supabase connectivity
    try {
      // Initialize Supabase only for an explicitly requested deep check. Keeping
      // this out of module scope lets shallow health checks and production builds
      // work before deployment credentials are injected.
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();
      const { error } = await supabase.from("user_profiles").select("id").limit(1);
      if (error) {
        health.checks.supabase = { status: "error", message: error.message };
        health.status = "degraded";
      } else {
        health.checks.supabase = { status: "ok" };
      }
    } catch (err) {
      health.checks.supabase = {
        status: "error",
        message: err instanceof Error ? err.message : "Unknown error",
      };
      health.status = "error";
    }
  }

  const statusCode = health.status === "error" ? 503 : 200;

  return NextResponse.json(health, { status: statusCode });
}
