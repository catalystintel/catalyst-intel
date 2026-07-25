import type { EventCategoryKey } from "@/lib/catalysts/taxonomy";

export type { ReportScope, ReportWindow } from "@/db/schema";
export { REPORT_SCOPE_VALUES, REPORT_WINDOW_VALUES } from "@/db/schema";

export interface ReportSnapshotItem {
  id: number;
  symbol: string | null;
  title: string;
  eventCategory: EventCategoryKey | null;
  impactScore: number | null;
  timestamp: string;
  sourceProvider: string | null;
  type: string;
}

export interface ReportSummary {
  id: number;
  title: string;
  window: import("@/db/schema").ReportWindow;
  scope: import("@/db/schema").ReportScope;
  shareToken: string;
  itemCount: number;
  createdAt: string;
}

export interface ReportDetail extends ReportSummary {
  items: ReportSnapshotItem[];
}
