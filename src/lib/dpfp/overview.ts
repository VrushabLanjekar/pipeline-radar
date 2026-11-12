import { addDays, fmtDay } from "./dates";
import { dayIndex, dayStatus, failTypeWords, reasonPhrase, type Status } from "./logic";
import type { Day, DpfpData, Pipeline } from "./types";

export interface PipelineRow {
  p: Pipeline;
  day: Day | undefined;
  status: Status | null;
  changed: boolean;
  last14: (Day | undefined)[];
  spark: number[];
}

export function overviewRows(data: DpfpData, date: string): PipelineRow[] {
  const th = data.threshold;
  return data.pipelines
    .map((p) => {
      const i = dayIndex(p, date);
      const day = i >= 0 ? p.days[i] : undefined;
      const prev = i > 0 ? p.days[i - 1] : undefined;
      const status = day ? dayStatus(day, th) : null;
      const map = new Map(p.days.map((d) => [d.d, d]));
      const last14 = Array.from({ length: 14 }, (_, k) => map.get(addDays(date, k - 13)));
      const spark = i >= 0 ? p.days.slice(Math.max(0, i - 29), i + 1).map((d) => d.p) : [];
      return {
        p,
        day,
        status,
        changed: !!(status && prev && dayStatus(prev, th) !== status),
        last14,
        spark,
      };
    })
    .sort((a, b) => (b.day?.p ?? -1) - (a.day?.p ?? -1));
}

export type BannerTone = "fail" | "alert" | "ok";

export function overviewBanner(rows: PipelineRow[], date: string, threshold: number) {
  const total = rows.length;
  const failed = rows.filter((r) => r.day?.s === "F");
  const alerts = rows.filter((r) => r.day && r.day.p >= threshold);
  const attention = rows.filter((r) => r.status === "failed" || r.status === "alert");
  const tomorrow = fmtDay(addDays(date, 1));
  const parts: string[] = [];
  let tone: BannerTone = "ok";

  if (attention.length === 0) {
    return {
      tone,
      text: `All ${total} pipelines look fine. No run is expected to break on ${tomorrow}.`,
    };
  }
  parts.push(
    `${attention.length} of ${total} pipeline${total === 1 ? "" : "s"} ${attention.length === 1 ? "needs" : "need"} attention.`,
  );
  for (const f of failed) {
    const tw = failTypeWords(f.day!.t);
    parts.push(`${f.p.name} failed on ${fmtDay(date)}${tw ? ` (${tw})` : ""}.`);
  }
  const top = alerts[0];
  if (top) {
    parts.push(`${top.p.name} may break on ${tomorrow}: likely ${reasonPhrase(top.day!.why[0])}.`);
    if (alerts.length > 1) parts.push(`${alerts.length - 1} more above the alert line.`);
  }
  tone = failed.length ? "fail" : "alert";
  return { tone, text: parts.join(" ") };
}
