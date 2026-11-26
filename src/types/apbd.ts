export type RegionLevel = "provinsi" | "kabupaten" | "kota";

export type IslandCluster =
  | "Sumatera"
  | "Jawa"
  | "Kalimantan"
  | "Sulawesi"
  | "Bali & Nusa Tenggara"
  | "Maluku & Papua";

export type HkpdGrade = "hijau" | "kuning" | "merah";

export type FiscalProfileLabel =
  | "Disiplin Fiskal & Dampak Tinggi"
  | "Mandiri Fiskal & Progresif"
  | "Tekanan Belanja Pegawai Tinggi"
  | "Belanja Modal Tinggi, Tantangan Sosial"
  | "Transisi Reformasi Fiskal";

export interface BudgetRevenue {
  total_pendapatan_miliar: number;
  realisasi_pendapatan_miliar: number;
  serapan_pendapatan_pct: number;
  pad_miliar: number;
  realisasi_pad_miliar: number;
  pajak_daerah_miliar: number;
  retribusi_daerah_miliar: number;
  tkd_miliar: number;
  realisasi_tkd_miliar: number;
  lain_lain_miliar: number;
  pad_ratio_pct: number;
  tkd_ratio_pct: number;
}

export interface BudgetExpenditure {
  total_belanja_miliar: number;
  realisasi_belanja_miliar: number;
  serapan_belanja_pct: number;
  pegawai_miliar: number;
  realisasi_pegawai_miliar: number;
  barang_jasa_miliar: number;
  realisasi_barang_jasa_miliar: number;
  modal_infrastruktur_miliar: number;
  realisasi_modal_miliar: number;
  lainnya_miliar: number;
  transfer_keluar_miliar: number;
  hibah_bansos_subsidi_miliar: number;
  tidak_terduga_miliar: number;
  pendidikan_miliar: number | null;
  kesehatan_miliar: number | null;
  pegawai_pct: number;
  barang_jasa_pct: number;
  modal_pct: number;
  infrastruktur_pct: number;
  infrastruktur_hkpd_pct: number | null;
  pendidikan_pct: number | null;
  kesehatan_pct: number | null;
  lainnya_pct: number;
  birokrasi_pct: number;
  publik_pct: number;
}

export interface HkpdAudit {
  score: number;
  grade: HkpdGrade;
  grade_label: string;
  pegawai_compliant: boolean;
  infrastruktur_compliant: boolean | null;
  pendidikan_compliant: boolean | null;
  pegawai_points: number;
  infrastruktur_points: number;
  pendidikan_points: number | null;
  serapan_points: number | null;
  infra_basis: "uu_hkpd_40" | "djpk_belanja_modal";
  scoring_basis: string;
}

export interface BpsIndicators {
  year: number;
  population: number | null;
  population_15_plus: number | null;
  poor_population_ribu: number | null;
  ipm: number | null;
  poverty_rate_pct: number | null;
  tpt_pct: number | null;
  apbd_per_capita_idr: number | null;
}

export interface EffectivenessIndex {
  social_outcome_score: number;
  effectiveness_score: number;
  archetype: FiscalProfileLabel;
  rank_national: number;
}

export interface DataProvenance {
  fiscal_year: number;
  djpk_periode: string;
  djpk_source_url: string;
  bps_source_url: string;
  bps_indicators_urls: {
    ipm: string | null;
    poverty: string | null;
    tpt: string | null;
    population_15_plus: string | null;
  };
  last_verified_at: string;
  is_verified_real_data: boolean;
  unavailable_official_fields: string[];
}

export interface AiAuditInsight {
  fiscal_finding: string;
  social_correlation: string;
  policy_recommendation: string;
  generated_by: string;
  audited_at: string;
}

export interface RegionRecord {
  id: string;
  bps_code: string;
  djpk_code: string;
  name: string;
  province_id: string;
  province_name: string;
  level: RegionLevel;
  island: IslandCluster;
  fiscal_year: number;
  centroid: [number, number];
  revenue: BudgetRevenue;
  expenditure: BudgetExpenditure;
  hkpd: HkpdAudit;
  bps: BpsIndicators;
  effectiveness: EffectivenessIndex;
  provenance: DataProvenance;
  ai_audit: AiAuditInsight;
}

export interface TierAggregateSummary {
  count: number;
  kabupaten_count?: number;
  kota_count?: number;
  total_apbd_triliun: number;
  total_realisasi_triliun: number;
  avg_serapan_pct: number;
  avg_hkpd_score: number;
  avg_pegawai_pct: number;
  avg_modal_pct: number;
  avg_pad_ratio_pct: number;
  grade_distribution: {
    hijau: number;
    kuning: number;
    merah: number;
  };
}

export interface NationalSummary {
  fiscal_year: number;
  bps_year: number;
  generated_at: string;
  is_verified_real_data: boolean;
  coverage_scope?: string;
  data_sources: string[];
  total_regions: number;
  total_provinces: number;
  total_kab_kota?: number;
  total_kab_kota_samples: number;
  total_kabupaten?: number;
  total_kota?: number;
  total_provinsi_apbd_triliun: number;
  total_provinsi_realisasi_triliun?: number;
  total_kab_kota_apbd_triliun?: number;
  total_kab_kota_realisasi_triliun?: number;
  total_apbd_triliun: number;
  total_realisasi_triliun: number;
  avg_serapan_pct: number;
  avg_hkpd_score: number;
  avg_pegawai_pct: number;
  avg_modal_pct: number;
  avg_infrastruktur_pct: number;
  avg_pendidikan_pct: number | null;
  avg_pad_ratio_pct: number;
  avg_birokrasi_pct: number;
  avg_publik_pct: number;
  avg_ipm: number;
  avg_poverty_pct: number;
  avg_tpt_pct: number;
  grade_distribution: {
    hijau: number;
    kuning: number;
    merah: number;
  };
  provinsi_aggregates?: TierAggregateSummary;
  kab_kota_aggregates?: TierAggregateSummary;
  top_efficient_ids: string[];
  needs_attention_ids: string[];
}

export interface TaxReceiptLineItem {
  key: string;
  label: string;
  sublabel: string;
  category: "aparatur" | "publik";
  percentage: number;
  amountIdr: number;
}

export interface TaxReceiptBreakdown {
  region: RegionRecord;
  taxAmountIdr: number;
  aparaturTotalIdr: number;
  publicTotalIdr: number;
  aparaturPct: number;
  publicPct: number;
  items: TaxReceiptLineItem[];
}
