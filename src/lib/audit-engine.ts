import type {
  HkpdAudit,
  HkpdGrade,
  RegionRecord,
  TaxReceiptBreakdown,
  TaxReceiptLineItem,
} from "@/types/apbd";

export const FISCAL_THRESHOLDS = {
  PEGAWAI_MAX_PCT: 30,
  INFRASTRUKTUR_HKPD_MIN_PCT: 40,
  MODAL_BENCHMARK_PCT: 15,
  PENDIDIKAN_MIN_PCT: 20,
  SERAPAN_TARGET_PCT: 85,
} as const;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Deterministic round-half-up to 1 decimal place (exact parity with Python ETL).
 */
export function round1(val: number): number {
  return Math.floor(val * 10 + 0.5 + 1e-9) / 10;
}

/**
 * Exact mirror of scripts/etl_pipeline.py::evaluate_hkpd().
 * Evaluates strictly verified DJPK figures with explicit null support for
 * unpublished functional accounts.
 */
export function evaluateHkpdCompliance(
  pegawaiPct: number,
  modalPct: number,
  infrastrukturHkpdPct: number | null,
  pendidikanPct: number | null,
  serapanBelanjaPct: number
): HkpdAudit {
  const pegawaiPoints =
    pegawaiPct <= FISCAL_THRESHOLDS.PEGAWAI_MAX_PCT
      ? 35 + Math.min(5, (FISCAL_THRESHOLDS.PEGAWAI_MAX_PCT - pegawaiPct) * 0.625)
      : Math.max(0, 35 - (pegawaiPct - FISCAL_THRESHOLDS.PEGAWAI_MAX_PCT) * 2.5);

  let infrastrukturPoints: number;
  let infrastrukturCompliant: boolean;
  let infraBasis: "uu_hkpd_40" | "djpk_belanja_modal";

  if (infrastrukturHkpdPct !== null) {
    infrastrukturPoints =
      infrastrukturHkpdPct >= FISCAL_THRESHOLDS.INFRASTRUKTUR_HKPD_MIN_PCT
        ? 30 +
          Math.min(
            5,
            (infrastrukturHkpdPct - FISCAL_THRESHOLDS.INFRASTRUKTUR_HKPD_MIN_PCT) *
              0.625
          )
        : Math.max(
            0,
            30 -
              (FISCAL_THRESHOLDS.INFRASTRUKTUR_HKPD_MIN_PCT -
                infrastrukturHkpdPct) *
                1.5
          );
    infrastrukturCompliant =
      infrastrukturHkpdPct >= FISCAL_THRESHOLDS.INFRASTRUKTUR_HKPD_MIN_PCT;
    infraBasis = "uu_hkpd_40";
  } else {
    infrastrukturPoints =
      modalPct >= FISCAL_THRESHOLDS.MODAL_BENCHMARK_PCT
        ? 28 + Math.min(7, (modalPct - FISCAL_THRESHOLDS.MODAL_BENCHMARK_PCT) * 0.7)
        : Math.max(
            0,
            28 - (FISCAL_THRESHOLDS.MODAL_BENCHMARK_PCT - modalPct) * 1.8
          );
    infrastrukturCompliant = modalPct >= FISCAL_THRESHOLDS.MODAL_BENCHMARK_PCT;
    infraBasis = "djpk_belanja_modal";
  }

  let pendidikanPoints: number | null;
  let pendidikanCompliant: boolean | null;
  let serapanPoints: number | null;
  let thirdPoints: number;
  let scoringBasis: string;

  if (pendidikanPct !== null) {
    pendidikanPoints =
      pendidikanPct >= FISCAL_THRESHOLDS.PENDIDIKAN_MIN_PCT
        ? 21 +
          Math.min(
            4,
            (pendidikanPct - FISCAL_THRESHOLDS.PENDIDIKAN_MIN_PCT) * 0.5
          )
        : Math.max(
            0,
            21 - (FISCAL_THRESHOLDS.PENDIDIKAN_MIN_PCT - pendidikanPct) * 3.0
          );
    pendidikanCompliant = pendidikanPct >= FISCAL_THRESHOLDS.PENDIDIKAN_MIN_PCT;
    serapanPoints = null;
    thirdPoints = pendidikanPoints;
    scoringBasis = "UU HKPD Penuh (3 Pilar Terverifikasi)";
  } else {
    pendidikanPoints = null;
    pendidikanCompliant = null;
    thirdPoints =
      serapanBelanjaPct >= FISCAL_THRESHOLDS.SERAPAN_TARGET_PCT
        ? 20 +
          Math.min(
            5,
            (serapanBelanjaPct - FISCAL_THRESHOLDS.SERAPAN_TARGET_PCT) * 0.5
          )
        : Math.max(
            0,
            20 -
              (FISCAL_THRESHOLDS.SERAPAN_TARGET_PCT - serapanBelanjaPct) * 0.9
          );
    serapanPoints = thirdPoints;
    scoringBasis =
      "DJPK Klasifikasi Ekonomi (Pegawai UU HKPD + Belanja Modal + Serapan Realisasi)";
  }

  const score = round1(
    clamp(pegawaiPoints + infrastrukturPoints + thirdPoints, 0, 100)
  );

  let grade: HkpdGrade = "merah";
  let gradeLabel = "Rapor Merah";
  if (score >= 80) {
    grade = "hijau";
    gradeLabel = "Rapor Hijau";
  } else if (score >= 60) {
    grade = "kuning";
    gradeLabel = "Rapor Kuning";
  }

  return {
    score,
    grade,
    grade_label: gradeLabel,
    pegawai_compliant: pegawaiPct <= FISCAL_THRESHOLDS.PEGAWAI_MAX_PCT,
    infrastruktur_compliant: infrastrukturCompliant,
    pendidikan_compliant: pendidikanCompliant,
    pegawai_points: round1(pegawaiPoints),
    infrastruktur_points: round1(infrastrukturPoints),
    pendidikan_points:
      pendidikanPoints !== null ? round1(pendidikanPoints) : null,
    serapan_points: serapanPoints !== null ? round1(serapanPoints) : null,
    infra_basis: infraBasis,
    scoring_basis: scoringBasis,
  };
}

/**
 * Computes exact Rupiah allocation for "Struk Belanja Pajak" thermal receipt
 * using 100% EXACT official DJPK Kemenkeu APBD economic accounts (zero invented weights).
 */
export function calculateTaxReceipt(
  region: RegionRecord,
  taxAmountIdr: number
): TaxReceiptBreakdown {
  const safeTax = Math.max(0, Math.round(taxAmountIdr));
  const exp = region.expenditure;
  const totalB = Math.max(0.01, exp.total_belanja_miliar);

  const rawBuckets = [
    {
      key: "pegawai",
      label: "BELANJA PEGAWAI (APARATUR)",
      sublabel: "Gaji, Tunjangan & Honorarium ASN (DJPK)",
      category: "aparatur" as const,
      miliar: Math.max(0, exp.pegawai_miliar),
    },
    {
      key: "barang_jasa",
      label: "BELANJA BARANG & JASA",
      sublabel: "Operasional Layanan, Pemeliharaan & Program",
      category: "publik" as const,
      miliar: Math.max(0, exp.barang_jasa_miliar),
    },
    {
      key: "modal",
      label: "BELANJA MODAL (INFRASTRUKTUR)",
      sublabel: "Jalan, Jembatan, Gedung, Irigasi & Peralatan",
      category: "publik" as const,
      miliar: Math.max(0, exp.modal_infrastruktur_miliar),
    },
    {
      key: "hibah_bansos",
      label: "HIBAH, SUBSIDI & BANTUAN SOSIAL",
      sublabel: "Dukungan Masyarakat, Lembaga & Subsidi Publik",
      category: "publik" as const,
      miliar: Math.max(0, exp.hibah_bansos_subsidi_miliar),
    },
    {
      key: "transfer_keluar",
      label: "BAGI HASIL & BANTUAN KEUANGAN",
      sublabel: "Transfer ke Kabupaten/Kota & Desa",
      category: "publik" as const,
      miliar: Math.max(0, exp.transfer_keluar_miliar),
    },
    {
      key: "tidak_terduga",
      label: "BELANJA TIDAK TERDUGA (BTT)",
      sublabel: "Dana Darurat Bencana & Keadaan Mendesak",
      category: "publik" as const,
      miliar: Math.max(0, exp.tidak_terduga_miliar),
    },
  ].filter((b) => b.miliar > 0);

  const sumMiliar = rawBuckets.reduce((acc, b) => acc + b.miliar, 0) || totalB;

  let allocated = 0;
  const items: TaxReceiptLineItem[] = rawBuckets.map((bucket, idx) => {
    const pct = round1((bucket.miliar / sumMiliar) * 100);
    let amountIdr: number;
    if (idx === rawBuckets.length - 1) {
      amountIdr = Math.max(0, safeTax - allocated);
    } else {
      amountIdr = Math.round((safeTax * bucket.miliar) / sumMiliar);
      allocated += amountIdr;
    }
    return {
      key: bucket.key,
      label: bucket.label,
      sublabel: bucket.sublabel,
      category: bucket.category,
      percentage: pct,
      amountIdr,
    };
  });

  const aparaturTotalIdr = items
    .filter((i) => i.category === "aparatur")
    .reduce((acc, i) => acc + i.amountIdr, 0);
  const publicTotalIdr = Math.max(0, safeTax - aparaturTotalIdr);

  const aparaturPct =
    safeTax > 0 ? round1((aparaturTotalIdr / safeTax) * 100) : exp.pegawai_pct;
  const publicPct = round1(100 - aparaturPct);

  return {
    region,
    taxAmountIdr: safeTax,
    aparaturTotalIdr,
    publicTotalIdr,
    aparaturPct,
    publicPct,
    items,
  };
}

/**
 * Checks whether two regions belong to the exact same administrative stratum
 * (Provinsi vs Kab/Kota) and identical Fiscal Capacity Cluster (Apple-to-Apple).
 */
export function areAppleToApplePeers(
  regionA: RegionRecord,
  regionB: RegionRecord
): boolean {
  const sameStratum =
    (regionA.level === "provinsi") === (regionB.level === "provinsi");
  return sameStratum && regionA.fiscal_cluster === regionB.fiscal_cluster;
}

/**
 * Selects a deterministic Apple-to-Apple peer from the exact same entity level
 * (Provinsi or Kab/Kota) and same fiscal_cluster as `regionA`, ranked by closest
 * fiscal capacity index and budget scale. Cycles to the next closest peer if
 * `currentRegionBId` is already a valid peer.
 */
export function findComparablePeer(
  regionA: RegionRecord,
  regions: RegionRecord[],
  currentRegionBId?: string
): RegionRecord | null {
  const isProvA = regionA.level === "provinsi";
  const capA = regionA.fiscal_capacity_index ?? 50;
  const apbdA = regionA.expenditure.total_belanja_miliar;

  const peers = regions
    .filter(
      (r) =>
        r.id !== regionA.id &&
        (r.level === "provinsi") === isProvA &&
        r.fiscal_cluster === regionA.fiscal_cluster
    )
    .sort((x, y) => {
      const capDiffX = Math.abs((x.fiscal_capacity_index ?? 50) - capA);
      const capDiffY = Math.abs((y.fiscal_capacity_index ?? 50) - capA);
      if (Math.abs(capDiffX - capDiffY) > 0.05) return capDiffX - capDiffY;
      const apbdDiffX = Math.abs(x.expenditure.total_belanja_miliar - apbdA);
      const apbdDiffY = Math.abs(y.expenditure.total_belanja_miliar - apbdA);
      if (apbdDiffX !== apbdDiffY) return apbdDiffX - apbdDiffY;
      return x.name.localeCompare(y.name, "id");
    });

  if (peers.length === 0) return null;
  if (currentRegionBId) {
    const currentIdx = peers.findIndex((p) => p.id === currentRegionBId);
    if (currentIdx !== -1 && peers.length > 1) {
      return peers[(currentIdx + 1) % peers.length];
    }
  }
  return peers[0];
}
