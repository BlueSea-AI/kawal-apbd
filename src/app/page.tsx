import * as React from "react";
import { loadApbdDataset } from "@/lib/data-loader";
import { KawalApbdApp } from "@/components/dashboard/KawalApbdApp";

export default async function HomePage() {
  const { regions, summary } = await loadApbdDataset();
  return <KawalApbdApp regions={regions} summary={summary} />;
}
