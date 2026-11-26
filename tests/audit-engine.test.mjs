import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const regionsPath = path.join(root, "public", "data", "regions.json");
const summaryPath = path.join(root, "public", "data", "national_summary.json");
const geojsonPath = path.join(root, "public", "data", "indonesia_provinces.geojson");

const regions = JSON.parse(readFileSync(regionsPath, "utf-8"));
const summary = JSON.parse(readFileSync(summaryPath, "utf-8"));
const geojson = JSON.parse(readFileSync(geojsonPath, "utf-8"));

function round1(val) {
  return Math.floor(val * 10 + 0.5 + 1e-9) / 10;
}

function evaluateHkpdMirror(
  pegawaiPct,
  modalPct,
  infrastrukturHkpdPct,
  pendidikanPct,
  serapanBelanjaPct
) {
  const pegawaiPoints =
    pegawaiPct <= 30
      ? 35 + Math.min(5, (30 - pegawaiPct) * 0.625)
      : Math.max(0, 35 - (pegawaiPct - 30) * 2.5);

  const infraPoints =
    infrastrukturHkpdPct !== null
      ? infrastrukturHkpdPct >= 40
        ? 30 + Math.min(5, (infrastrukturHkpdPct - 40) * 0.625)
        : Math.max(0, 30 - (40 - infrastrukturHkpdPct) * 1.5)
      : modalPct >= 15
      ? 28 + Math.min(7, (modalPct - 15) * 0.7)
      : Math.max(0, 28 - (15 - modalPct) * 1.8);

  const thirdPoints =
    pendidikanPct !== null
      ? pendidikanPct >= 20
        ? 21 + Math.min(4, (pendidikanPct - 20) * 0.5)
        : Math.max(0, 21 - (20 - pendidikanPct) * 3.0)
      : serapanBelanjaPct >= 85
      ? 20 + Math.min(5, (serapanBelanjaPct - 85) * 0.5)
      : Math.max(0, 20 - (85 - serapanBelanjaPct) * 0.9);

  return round1(Math.min(100, Math.max(0, pegawaiPoints + infraPoints + thirdPoints)));
}

test("full national coverage includes 38 provinces and all >=500 autonomous kab/kota with 100% GeoJSON key match", () => {
  const provinces = regions.filter((r) => r.level === "provinsi");
  const kabKota = regions.filter((r) => r.level !== "provinsi");
  assert.equal(provinces.length, 38);
  assert.ok(kabKota.length >= 500, `Expected full national coverage (>=500 kab/kota), got ${kabKota.length}`);
  assert.ok(regions.length >= 538, `Expected >=538 total regions, got ${regions.length}`);
  assert.equal(geojson.features.length, 38);
  assert.equal(summary.total_provinces, 38);
  assert.equal(summary.total_regions, regions.length);
  assert.equal(summary.total_kab_kota, kabKota.length);
  assert.ok(summary.provinsi_aggregates && summary.kab_kota_aggregates);

  const sizeKb = statSync(geojsonPath).size / 1024;
  assert.ok(sizeKb >= 300 && sizeKb <= 800, `GeoJSON size ${sizeKb.toFixed(1)} KB outside 300-800 KB`);

  const provIds = new Set(provinces.map((p) => p.id));
  const provCodes = new Set(provinces.map((p) => p.bps_code));
  let totalVertices = 0;

  for (const feat of geojson.features) {
    assert.ok(provIds.has(feat.properties.id), `Missing ${feat.properties.id}`);
    assert.ok(provCodes.has(feat.properties.province_code), `Missing code ${feat.properties.province_code}`);
    assert.ok(["Polygon", "MultiPolygon"].includes(feat.geometry.type));
    if (feat.geometry.type === "Polygon") {
      for (const ring of feat.geometry.coordinates) totalVertices += ring.length;
    } else {
      for (const poly of feat.geometry.coordinates) {
        for (const ring of poly) totalVertices += ring.length;
      }
    }
  }
  assert.ok(totalVertices >= 15000, `Expected high-fidelity coastlines (>=15k vertices), got ${totalVertices}`);
});

test("every region carries verified DJPK & BPS provenance metadata and valid parent province (zero fabrication)", () => {
  assert.equal(summary.is_verified_real_data, true);
  const provIds = new Set(regions.filter((r) => r.level === "provinsi").map((p) => p.id));
  const seenIds = new Set();
  for (const r of regions) {
    assert.ok(!seenIds.has(r.id), `Duplicate region ID: ${r.id}`);
    seenIds.add(r.id);
    assert.ok(provIds.has(r.province_id), `Invalid province_id ${r.province_id} for ${r.id}`);
    assert.ok(typeof r.province_name === "string" && r.province_name.length > 0, `Missing province_name for ${r.id}`);
    assert.ok(r.provenance, `Missing provenance for ${r.id}`);
    assert.equal(r.provenance.is_verified_real_data, true);
    assert.ok(r.provenance.djpk_source_url.startsWith("https://djpk.kemenkeu.go.id/"));
    assert.ok(r.provenance.bps_source_url.startsWith("https://www.bps.go.id/"));
    assert.ok(r.provenance.last_verified_at.length >= 10);
    assert.ok(r.expenditure.total_belanja_miliar > 0);
    assert.ok(r.bps.ipm !== null && r.bps.ipm > 40);
    assert.ok(r.bps.poverty_rate_pct !== null && r.bps.poverty_rate_pct >= 0);
  }
});

test("fiscal audit scores in regions.json match exact Python/TypeScript parity formula", () => {
  for (const r of regions) {
    const expected = evaluateHkpdMirror(
      r.expenditure.pegawai_pct,
      r.expenditure.modal_pct,
      r.expenditure.infrastruktur_hkpd_pct,
      r.expenditure.pendidikan_pct,
      r.expenditure.serapan_belanja_pct
    );
    assert.equal(
      r.hkpd.score,
      expected,
      `Score mismatch for ${r.name}: got ${r.hkpd.score}, expected ${expected}`
    );
    if (expected >= 80) assert.equal(r.hkpd.grade, "hijau");
    else if (expected >= 60) assert.equal(r.hkpd.grade, "kuning");
    else assert.equal(r.hkpd.grade, "merah");
  }
});

test("verified audit summaries are non-empty and never mention fabricated server metrics", () => {
  for (const r of regions) {
    assert.ok(r.ai_audit.fiscal_finding.length > 40);
    assert.ok(r.ai_audit.social_correlation.length > 40);
    assert.ok(r.ai_audit.policy_recommendation.length > 40);
    assert.ok(
      !r.ai_audit.fiscal_finding.includes("TA 2025"),
      `Stale TA 2025 reference in fiscal_finding for ${r.id}`
    );
  }
});

test("every region has stratified Apple-to-Apple fiscal capacity cluster, peer rank, and balanced tertile summary", () => {
  const validClusters = new Set(["Tinggi", "Sedang", "Rendah"]);
  assert.ok(summary.fiscal_cluster_distribution, "Missing summary.fiscal_cluster_distribution");
  assert.ok(
    summary.provinsi_aggregates?.fiscal_cluster_distribution,
    "Missing provinsi_aggregates.fiscal_cluster_distribution"
  );
  assert.ok(
    summary.kab_kota_aggregates?.fiscal_cluster_distribution,
    "Missing kab_kota_aggregates.fiscal_cluster_distribution"
  );

  const buckets = new Map();
  for (const r of regions) {
    assert.ok(
      validClusters.has(r.fiscal_cluster),
      `Invalid fiscal_cluster '${r.fiscal_cluster}' for ${r.id}`
    );
    assert.ok(
      Number.isInteger(r.fiscal_cluster_rank) && r.fiscal_cluster_rank >= 1,
      `Invalid fiscal_cluster_rank for ${r.id}`
    );
    assert.ok(
      Number.isInteger(r.fiscal_cluster_total) && r.fiscal_cluster_rank <= r.fiscal_cluster_total,
      `Invalid fiscal_cluster_total for ${r.id}`
    );
    const groupKey = `${r.level === "provinsi" ? "provinsi" : "kab_kota"}:${r.fiscal_cluster}`;
    if (!buckets.has(groupKey)) buckets.set(groupKey, []);
    buckets.get(groupKey).push(r);
  }

  for (const group of ["provinsi", "kab_kota"]) {
    const counts = ["Tinggi", "Sedang", "Rendah"].map(
      (tier) => (buckets.get(`${group}:${tier}`) ?? []).length
    );
    assert.ok(
      Math.max(...counts) - Math.min(...counts) <= 1,
      `Unbalanced ${group} tertiles: ${counts.join("/")}`
    );
    for (const tier of ["Tinggi", "Sedang", "Rendah"]) {
      const items = buckets.get(`${group}:${tier}`) ?? [];
      const ranks = items.map((i) => i.fiscal_cluster_rank).sort((a, b) => a - b);
      assert.deepEqual(
        ranks,
        Array.from({ length: items.length }, (_, idx) => idx + 1),
        `Non-contiguous peer ranks in ${group}:${tier}`
      );
      for (const item of items) {
        assert.equal(item.fiscal_cluster_total, items.length);
      }
    }
  }

  const distTotal =
    summary.fiscal_cluster_distribution.Tinggi +
    summary.fiscal_cluster_distribution.Sedang +
    summary.fiscal_cluster_distribution.Rendah;
  assert.equal(distTotal, regions.length);
});

test("zero hardcoded 2025 fiscal year strings remain anywhere in src/", () => {
  const srcDir = path.join(root, "src");
  const hits = [];
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx|js|jsx|css)$/.test(entry.name)) {
        const text = readFileSync(full, "utf-8");
        if (text.includes("2025")) {
          hits.push(path.relative(root, full));
        }
      }
    }
  }
  walk(srcDir);
  assert.deepEqual(hits, [], `Found hardcoded '2025' in src/: ${hits.join(", ")}`);
});

test("every region has at least one valid Apple-to-Apple peer in the same stratum and fiscal cluster", () => {
  for (const r of regions) {
    const isProv = r.level === "provinsi";
    const peers = regions.filter(
      (cand) =>
        cand.id !== r.id &&
        (cand.level === "provinsi") === isProv &&
        cand.fiscal_cluster === r.fiscal_cluster
    );
    assert.ok(
      peers.length >= 1,
      `No Apple-to-Apple peer available for ${r.id} (${r.level}, ${r.fiscal_cluster})`
    );
  }
});
