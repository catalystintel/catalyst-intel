import { NextResponse } from "next/server";

import { db } from "@/db/client";
import { isLibsqlConfigured } from "@/db/env";

export const dynamic = "force-dynamic";

/**
 * Public liveness/readiness probe for uptime monitors (UptimeRobot, Better
 * Stack, Vercel checks, etc.). Does not require auth. Avoids leaking secrets;
 * only reports coarse DB reachability.
 */
export async function GET() {
  const checkedAt = new Date().toISOString();

  if (!isLibsqlConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        status: "db_not_configured",
        checkedAt,
      },
      { status: 503 },
    );
  }

  try {
    // Cheap round-trip — fails closed if Turso is unreachable.
    await db.$client.execute("SELECT 1");
    return NextResponse.json({
      ok: true,
      status: "ok",
      checkedAt,
    });
  } catch (error) {
    const detail =
      error instanceof Error ? error.message.slice(0, 120) : "db_unreachable";
    return NextResponse.json(
      {
        ok: false,
        status: "db_unreachable",
        detail,
        checkedAt,
      },
      { status: 503 },
    );
  }
}
