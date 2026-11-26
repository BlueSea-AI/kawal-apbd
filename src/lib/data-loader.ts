import { readFile } from "fs/promises";
import path from "path";
import type { NationalSummary, RegionRecord } from "@/types/apbd";

const DATA_DIR = path.join(process.cwd(), "public", "data");

export async function loadApbdDataset(): Promise<{
  regions: RegionRecord[];
  summary: NationalSummary;
}> {
  const [regionsRaw, summaryRaw] = await Promise.all([
    readFile(path.join(DATA_DIR, "regions.json"), "utf-8"),
    readFile(path.join(DATA_DIR, "national_summary.json"), "utf-8"),
  ]);

  const regions = JSON.parse(regionsRaw) as RegionRecord[];
  const summary = JSON.parse(summaryRaw) as NationalSummary;

  return { regions, summary };
}
