export type RunStatus = "F" | "W" | "S";
export type FailType = "bad" | "slow" | "";

export interface Day {
  d: string;
  s: RunStatus;
  t: FailType;
  p: number;
  p2: number;
  p3: number;
  rows: number;
  sig: [number, number, number, number];
  why: string[];
  logged?: boolean;
}

export interface Pipeline {
  id: string;
  name: string;
  source: string;
  table: string;
  owner: string;
  real: boolean;
  lowconf: boolean;
  dq_failures: number;
  n_total: number;
  fail_total: number;
  fail_before: number;
  norm: [number, number][];
  days: Day[];
}

export interface HorizonScore {
  days_ahead: number;
  test_PR_AUC: number;
  test_ROC_AUC: number;
  base_rate: number;
  lift: number;
  test_failures: number;
  n_rows: number;
}

export interface PerformanceRow {
  retrain_date: string;
  data_through: string;
  n_rows: number;
  n_failures: number;
  fail_rate: number;
  test_PR_AUC: number;
  test_ROC_AUC: number;
  base_rate: number;
}

export interface DpfpData {
  threshold: number;
  built_at: string;
  data_through: string;
  model_trained: string;
  required_columns: string[];
  horizon_scores: HorizonScore[];
  performance: PerformanceRow[];
  pipelines: Pipeline[];
}

export interface ForecastLogRow {
  made_from: string;
  days_ahead: number;
  for_date: string;
  pipeline: string;
  risk: number;
  alert: boolean;
  logged_at: string;
}

export interface HistoryRun {
  d: string;
  s: RunStatus;
  type: string;
}
