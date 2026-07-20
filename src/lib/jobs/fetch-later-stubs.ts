import {
  skippedSourceResult,
  type SourceFetchResult,
} from "@/lib/jobs/ingest-pipeline";

/** Later-phase sources — stubbed so the orchestrator can list them without failing. */
const LATER_SOURCES = [
  {
    id: "courtlistener",
    message: "CourtListener ingest not implemented yet (later phase).",
  },
  {
    id: "eia",
    message: "EIA energy data ingest not implemented yet (later phase).",
  },
  {
    id: "cisa",
    message: "CISA alerts ingest not implemented yet (later phase).",
  },
  {
    id: "crypto",
    message: "Crypto catalyst ingest not implemented yet (later phase).",
  },
  {
    id: "esg",
    message: "ESG catalyst ingest not implemented yet (later phase).",
  },
] as const;

export type LaterSourceId = (typeof LATER_SOURCES)[number]["id"];

export function stubLaterSource(id: LaterSourceId): SourceFetchResult {
  const found = LATER_SOURCES.find((s) => s.id === id);
  return skippedSourceResult(id, found?.message ?? "Not implemented.");
}

export function listLaterSourceStubs(): SourceFetchResult[] {
  return LATER_SOURCES.map((s) => skippedSourceResult(s.id, s.message));
}
