import type { ForecastLogRow, HistoryRun, RunStatus } from "./types";

/** Minimal RFC-4180 parser: quoted fields, escaped quotes, CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    if (row.length > 1 || row[0] !== "") rows.push(row);
  }
  return rows;
}

export function csvToObjects(text: string): { header: string[]; rows: Record<string, string>[] } {
  const all = parseCsv(text);
  const header = (all[0] ?? []).map((h) => h.trim());
  const rows = all.slice(1).map((r) => {
    const o: Record<string, string> = {};
    header.forEach((h, i) => (o[h] = (r[i] ?? "").trim()));
    return o;
  });
  return { header, rows };
}

/** FAIL -> F; else WARNING -> W; else S. */
export function runStatusFromRow(overall: string, warning: string): RunStatus {
  if (overall.toUpperCase() === "FAIL") return "F";
  if (warning.toUpperCase() === "WARNING") return "W";
  return "S";
}

/** Full run history: one entry per run_date (last row wins), sorted by date. */
export function parseHistory(text: string): HistoryRun[] {
  const { header, rows } = csvToObjects(text);
  for (const col of ["run_date", "overall_status"]) {
    if (!header.includes(col)) throw new Error(`Run log is missing the "${col}" column`);
  }
  const byDate = new Map<string, HistoryRun>();
  for (const r of rows) {
    const d = r["run_date"]?.slice(0, 10);
    if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    byDate.set(d, {
      d,
      s: runStatusFromRow(r["overall_status"] ?? "", r["warning_status"] ?? ""),
      type: r["failure_type"] ?? "",
    });
  }
  return [...byDate.values()].sort((a, b) => (a.d < b.d ? -1 : 1));
}

export function parseForecastLog(text: string): ForecastLogRow[] {
  const { header, rows } = csvToObjects(text);
  for (const col of ["made_from", "days_ahead", "for_date", "pipeline", "risk"]) {
    if (!header.includes(col)) throw new Error(`Forecast log is missing the "${col}" column`);
  }
  return rows.map((r) => ({
    made_from: r["made_from"] ?? "",
    days_ahead: Number(r["days_ahead"]),
    for_date: r["for_date"] ?? "",
    pipeline: r["pipeline"] ?? "",
    risk: Number(r["risk"]),
    alert: r["alert"] === "1" || r["alert"]?.toLowerCase() === "true",
    logged_at: r["logged_at"] ?? "",
  }));
}
