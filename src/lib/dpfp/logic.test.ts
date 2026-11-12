import { describe, expect, it } from "vitest";
import { parseHistory, runStatusFromRow } from "./csv";
import { fmtDay, isDataLate, nextUpdate } from "./dates";
import { backtest, buildTrackRecord, dayOutcome, reasonSignal, wasWarned } from "./logic";
import { overviewBanner, overviewRows } from "./overview";
import type { Day, DpfpData, Pipeline } from "./types";

const day = (d: string, s: Day["s"], p: number, why: string[] = []): Day => ({
  d, s, t: s === "F" ? "bad" : "", p, p2: p, p3: p, rows: 24, sig: [0, 0, 0, 0], why,
});

const TH = 0.1;
const days: Day[] = [
  day("2026-11-01", "S", 0.2), // alert for 11-02 -> F  => warned
  day("2026-11-02", "F", 0.05), // quiet for 11-03 -> S
  day("2026-11-03", "S", 0.05), // quiet for 11-04 -> F  => missed
  day("2026-11-04", "F", 0.15), // alert for 11-05 -> W  => false alarm
  day("2026-11-05", "W", 0.12), // alert, outcome unknown
];

describe("forecast scoring", () => {
  it("a failure on day X is warned when days[X-1].p >= threshold", () => {
    expect(wasWarned(days, 1, TH)).toBe(true);
    expect(wasWarned(days, 3, TH)).toBe(false);
  });

  it("day outcome judges the forecast for the next day", () => {
    expect(dayOutcome(days, 0, TH)).toBe("hit");
    expect(dayOutcome(days, 1, TH)).toBe("quiet");
    expect(dayOutcome(days, 2, TH)).toBe("missed");
    expect(dayOutcome(days, 3, TH)).toBe("false_alarm");
    expect(dayOutcome(days, 4, TH)).toBe("pending");
  });

  it("backtest counters follow the alert line", () => {
    const b = backtest(days, TH);
    expect(b).toMatchObject({ failures: 2, warned: 1, missed: 1, falseAlarms: 1, alertDays: 3 });
    expect(b.falseAlarmsPerMonth).toBeCloseTo(1 / (4 / 30));
    expect(backtest(days, 0.01).warned).toBe(2);
  });
});

describe("track record", () => {
  it("uses only days_ahead = 1 rows and the as-made alert flag", () => {
    const p = { id: "delhi", name: "air_quality_delhi", days } as Pipeline;
    const rows = buildTrackRecord(
      [
        { made_from: "2026-11-01", days_ahead: 1, for_date: "2026-11-02", pipeline: "delhi", risk: 0.2, alert: true, logged_at: "" },
        { made_from: "2026-11-01", days_ahead: 2, for_date: "2026-11-03", pipeline: "delhi", risk: 0.2, alert: true, logged_at: "" },
        { made_from: "2026-11-05", days_ahead: 1, for_date: "2026-11-06", pipeline: "delhi", risk: 0.12, alert: true, logged_at: "" },
      ],
      [p],
      TH,
    );
    expect(rows.map((r) => r.outcome)).toEqual(["pending", "hit"]);
  });
});

describe("run history status rule", () => {
  it("FAIL -> F, else WARNING -> W, else S", () => {
    expect(runStatusFromRow("FAIL", "WARNING")).toBe("F");
    expect(runStatusFromRow("SUCCESS", "WARNING")).toBe("W");
    expect(runStatusFromRow("SUCCESS", "NONE")).toBe("S");
  });

  it("keeps the last row when a run_date repeats", () => {
    const csv = 'run_date,overall_status,warning_status,failure_type,note\n2026-11-02,SUCCESS,NONE,,"a, b"\n2026-11-01,FAIL,NONE,API_SLA_BREACH,x\n2026-11-02,FAIL,WARNING,DATA_QUALITY_FAILURE,y\n';
    expect(parseHistory(csv)).toEqual([
      { d: "2026-11-01", s: "F", type: "API_SLA_BREACH" },
      { d: "2026-11-02", s: "F", type: "DATA_QUALITY_FAILURE" },
    ]);
  });
});

describe("freshness", () => {
  it("next update is the next 08:00 IST", () => {
    expect(nextUpdate(new Date("2026-11-12T13:19:00Z")).toISOString()).toBe("2026-11-13T02:30:00.000Z");
    expect(nextUpdate(new Date("2026-11-12T01:00:00Z")).toISOString()).toBe("2026-11-12T02:30:00.000Z");
  });

  it("data is late after 30 hours", () => {
    const built = "2026-11-12T15:30+05:30"; // 10:00 UTC
    expect(isDataLate(built, new Date("2026-11-13T15:59:00Z"))).toBe(false);
    expect(isDataLate(built, new Date("2026-11-13T16:01:00Z"))).toBe(true);
  });

  it("formats dates like Thu 12 Nov", () => {
    expect(fmtDay("2026-11-12")).toBe("Thu 12 Nov");
  });
});

describe("overview banner", () => {
  const data = {
    threshold: TH,
    pipelines: [
      { id: "delhi", name: "air_quality_delhi", days: [day("2026-11-10", "W", 0.05), day("2026-11-11", "W", 0.17, ["Extreme readings"])] },
      { id: "pune", name: "air_quality_pune", days: [day("2026-11-10", "S", 0.05), day("2026-11-11", "S", 0.06)] },
    ],
  } as unknown as DpfpData;

  it("amber with the top pipeline and next-day date when one is above the line", () => {
    const rows = overviewRows(data, "2026-11-11");
    expect(rows[0]?.changed).toBe(true);
    expect(overviewBanner(rows, "2026-11-11", TH)).toEqual({
      tone: "alert",
      text: "1 of 2 pipelines needs attention. air_quality_delhi may break on Thu 12 Nov: likely broken values from sudden jumps.",
    });
  });

  it("green when nothing is above the line", () => {
    expect(overviewBanner(overviewRows(data, "2026-11-10"), "2026-11-10", TH).tone).toBe("ok");
  });

  it("maps reasons to signals", () => {
    expect(reasonSignal("Slow run")).toBe(2);
    expect(reasonSignal("A sensor got stuck")).toBe(0);
    expect(reasonSignal("Time of year: failures are more common now")).toBeNull();
  });
});
