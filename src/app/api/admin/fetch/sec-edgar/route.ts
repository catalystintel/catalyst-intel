import { NextResponse } from "next/server";

import { getCurrentAppUser } from "@/lib/auth/current-user";
import { fetchSecEdgar } from "@/lib/jobs/fetch-sec-edgar";

export async function POST() {
  const user = await getCurrentAppUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  if (user.role !== "admin") {
    return NextResponse.json({ error: "Admin role required." }, { status: 403 });
  }

  try {
    const result = await fetchSecEdgar();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Fetch job failed." },
      { status: 500 },
    );
  }
}
