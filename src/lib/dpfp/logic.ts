import { addDays } from "./dates";
import type { Day, ForecastLogRow, Pipeline, RunStatus } from "./types";

export type Status = "failed" | "alert" | "ok";
export type Outcome = "hit" | "missed" | "false_alarm" | "quiet" | "pending";

export const SIGNALS = [
  "Missing rows (%)",
  "Data drift (PSI)",
  "Source speed (s)",
  "Sudden jumps",
] as const;

const REASON_SIGNAL: Record<string, number> = {
  "Sudden jumps in readings": 3,
  "Many sudden jumps this week": 3,
  "Extreme readings": 3,
  "Source speed changed": 2,
  "Source speed is unstable": 2,
  "Source is slow": 2,
  "Slow run": 2,
  "Data looks different from normal": 1,
  "Data looks unusual this week": 1,
  "Invalid values": 0,
  "A sensor got stuck": 0,
};

export function reasonSignal(reason: string): number | null {
  return REASON_SIGNAL[reason] ?? null;
}

/** Short phrase used in the banner: "likely <phrase>". */
export function reasonPhrase(reason: string | undefined): string {
  if (!reason) return "no single clear cause";
  const sig = reasonSignal(reason);
  if (sig === 3) return "broken values from sudden jumps";
  if (sig === 1) return "broken values from unusual data";
  if (sig === 0) return "broken values from invalid readings";
  if (sig === 2) return "the source API being too slow";
  const r = reason.toLowerCase();
  if (r.includes("fail")) return "a repeat of recent failures";
  if (r.includes("time of year")) return "seasonal trouble (failures are more common now)";
  return r;
}

export function failTypeWords(t: string): string {
  if (t === "bad" || t === "DATA_QUALITY_FAILURE") return "broken values";
  if (t === "slow" || t === "API_SLA_BREACH") return "API too slow";
  return "";
}

export function runStatusWords(s: RunStatus | undefined): string {
  if (s === "F") return "Failed";
  if (s === "W") return "Ran with a data warning";
  if (s === "S") return "Ran clean";
  return "No run";
}

export function dayStatus(day: Day, threshold: number): Status {
  if (day.s === "F") return "failed";
  if (day.p >= threshold) return "alert";
  return "ok";
}

export function dayIndex(p: Pipeline, date: string): number {
  return p.days.findIndex((d) => d.d === date);
}

/** Outcome of a forecast given the actual status of the day it was for. */
export function forecastOutcome(
  risk: number,
  threshold: number,
  actual: RunStatus | undefined,
  alertFlag?: boolean,
): Outcome {
  if (!actual) return "pending";
  const alert = alertFlag ?? risk >= threshold;
  if (actual === "F") return alert ? "hit" : "missed";
  return alert ? "false_alarm" : "quiet";
}

/** Outcome of the forecast made on days[idx] (for days[idx] + 1). */
export function dayOutcome(days: Day[], idx: number, threshold: number): Outcome {
  const day = days[idx];
  if (!day) return "pending";
  const next = days[idx + 1];
  const actual = next && next.d === addDays(day.d, 1) ? next.s : undefined;
  return forecastOutcome(day.p, threshold, actual);
}

/** Was the failure on days[idx] warned? = days[idx-1].p >= threshold. */
export function wasWarned(days: Day[], idx: number, threshold: number): boolean {
  return idx > 0 && (days[idx - 1]?.p ?? 0) >= threshold;
}

export interface Backtest {
  failures: number;
  warned: number;
  missed: number;
  falseAlarms: number;
  falseAlarmsPerMonth: number;
  alertDays: number;
  evaluatedDays: number;
}

export function backtest(days: Day[], threshold: number): Backtest {
  let failures = 0;
  let warned = 0;
  let falseAlarms = 0;
  let evaluated = 0;
  for (let i = 1; i < days.length; i++) {
    evaluated++;
    const alert = days[i - 1]!.p >= threshold;
    if (days[i]!.s === "F") {
      failures++;
      if (alert) warned++;
    } else if (alert) falseAlarms++;
  }
  const alertDays = days.filter((d) => d.p >= threshold).length;
  return {
    failures,
    warned,
    missed: failures - warned,
    falseAlarms,
    falseAlarmsPerMonth: evaluated ? falseAlarms / (evaluated / 30) : 0,
    alertDays,
    evaluatedDays: evaluated,
  };
}

export type SignalLevel = "normal" | "above" | "high";

/** norm = [typical, high] */
export function signalLevel(v: number, norm: [number, number]): SignalLevel {
  if (v > norm[1]) return "high";
  if (v > norm[0]) return "above";
  return "normal";
}

export interface TrackRow extends ForecastLogRow {
  actual: RunStatus | undefined;
  outcome: Outcome;
  pipelineName: string;
}

/** As-made 1-day-ahead forecasts joined to what actually happened. Newest first. */
export function buildTrackRecord(
  log: ForecastLogRow[],
  pipelines: Pipeline[],
  threshold: number,
): TrackRow[] {
  const lookup = new Map<string, Map<string, RunStatus>>();
  for (const p of pipelines) lookup.set(p.id, new Map(p.days.map((d) => [d.d, d.s])));
  const latest = new Map<string, ForecastLogRow>();
  for (const r of log) {
    if (r.days_ahead !== 1) continue;
    latest.set(`${r.pipeline}|${r.for_date}`, r); // keep the last save for a date
  }
  return [...latest.values()]
    .map((r) => {
      const actual = lookup.get(r.pipeline)?.get(r.for_date);
      return {
        ...r,
        actual,
        outcome: forecastOutcome(r.risk, threshold, actual, r.alert),
        pipelineName: pipelines.find((p) => p.id === r.pipeline)?.name ?? r.pipeline,
      };
    })
    .sort((a, b) =>
      a.for_date === b.for_date
        ? a.pipeline.localeCompare(b.pipeline)
        : a.for_date < b.for_date
          ? 1
          : -1,
    );
}

export function outcomeCounts(rows: { outcome: Outcome }[]) {
  const c = { hit: 0, missed: 0, false_alarm: 0, quiet: 0, pending: 0 };
  for (const r of rows) c[r.outcome]++;
  return c;
}

export function allDates(pipelines: Pipeline[]): string[] {
  const s = new Set<string>();
  for (const p of pipelines) for (const d of p.days) s.add(d.d);
  return [...s].sort();
}
