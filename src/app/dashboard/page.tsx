import { redirect } from "next/navigation";
import { desc } from "drizzle-orm";

import { AppHeader } from "@/components/app-header";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/db/client";
import { catalysts } from "@/db/schema";
import { getCurrentAppUser } from "@/lib/auth/current-user";

export default async function DashboardPage() {
  const user = await getCurrentAppUser();

  if (!user) {
    redirect("/login?next=/dashboard");
  }

  const recentCatalysts = await db
    .select()
    .from(catalysts)
    .orderBy(desc(catalysts.timestamp))
    .limit(50)
    .all();

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader email={user.email} role={user.role} />
      <main className="flex flex-1 flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Live catalysts</h1>
            <p className="text-sm text-muted-foreground">
              Most recent market-moving events, newest first.
            </p>
          </div>
          <span className="text-xs text-muted-foreground">
            {recentCatalysts.length} shown
          </span>
        </div>

        {recentCatalysts.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-12 text-center">
            <p className="text-sm font-medium">No catalysts yet</p>
            <p className="text-sm text-muted-foreground">
              {user.role === "admin"
                ? "Head to the Admin page and click \u201cFetch SEC EDGAR now\u201d to populate data."
                : "Data will appear here once an admin runs the first ingestion job."}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticker</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="text-right">Filed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentCatalysts.map((catalyst) => (
                  <TableRow key={catalyst.id}>
                    <TableCell>
                      {catalyst.ticker ? (
                        <Badge variant="secondary">{catalyst.ticker}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{catalyst.type}</TableCell>
                    <TableCell>{catalyst.title}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {new Date(catalyst.timestamp).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </main>
    </div>
  );
}
