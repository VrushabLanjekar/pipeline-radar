import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { fmtDay, fmtShortYear, pct } from "@/lib/dpfp/dates";
import { buildTrackRecord, outcomeCounts, type TrackRow } from "@/lib/dpfp/logic";
import { dataQuery, forecastLogQuery } from "@/lib/dpfp/queries";
import type { DpfpData, ForecastLogRow } from "@/lib/dpfp/types";
import { QueryGate } from "@/components/radar/states";
import { CountUp, OutcomeBadge, SectionTitle } from "@/components/radar/primitives";

export const Route = createFileRoute("/track-record")({
  head: () => ({
    meta: [
      { title: "Track record · Pipeline Radar" },
      {
        name: "description",
        content: "Every 1-day failure forecast as it was made, compared with what actually happened.",
      },
      { property: "og:title", content: "Forecast track record · Pipeline Radar" },
      {
        property: "og:description",
        content: "Honest, as-made pipeline failure forecasts and their outcomes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TrackRecordPage,
});

function TrackRecordPage() {
  const dq = useQuery(dataQuery);
  const lq = useQuery(forecastLogQuery);
  return (
    <QueryGate query={dq}>
      {(data) => (
        <QueryGate query={lq} title="Could not load the forecast log" loadingLabel="Loading the forecast log">
          {(log) => <TrackRecord data={data} log={log} />}
        </QueryGate>
      )}
    </QueryGate>
  );
}

function TrackRecord({ data, log }: { data: DpfpData; log: ForecastLogRow[] }) {
  const rows = useMemo(() => buildTrackRecord(log, data.pipelines, data.threshold), [log, data]);
  const c = outcomeCounts(rows);
  const started = log
    .map((r) => (r.logged_at || r.made_from).slice(0, 10))
    .filter(Boolean)
    .sort()[0];
  const decided = rows.length - c.pending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Track record</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every forecast here was saved the morning it was made, before the outcome was known.
        </p>
      </div>

      {rows.length < 60 && (
        <div className="rounded-md border bg-neutral-soft px-3 py-2.5 text-sm">
          {started ? <>Log started <span className="font-mono">{fmtShortYear(started)}</span>; </> : null}
          this record grows every day. With only <span className="font-mono">{rows.length}</span> forecasts so far
          {decided ? ` (${decided} with a known outcome)` : ""}, it is too early to judge the model from this page alone.
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
        <Total label="Forecasts" value={rows.length} />
        <Total label="Came true" value={c.hit} tone="ok" />
        <Total label="Missed" value={c.missed} tone="fail" />
        <Total label="False alarms" value={c.false_alarm} tone="alert" />
        <Total label="Correctly quiet" value={c.quiet} />
        <Total label="Pending" value={c.pending} />
      </div>

      <section>
        <SectionTitle>1-day-ahead forecasts · newest first</SectionTitle>
        {rows.length === 0 ? (
          <p className="panel px-4 py-8 text-center text-sm text-muted-foreground">The log has no 1-day forecasts yet.</p>
        ) : (
          <>
            <div className="panel hidden overflow-hidden md:block">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/60">
                  <tr className="text-left">
                    {["Forecast made", "For date", "Pipeline", "Risk", "Alert", "Outcome"].map((h) => (
                      <th key={h} className="label-caps px-3 py-2 font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={`${r.pipeline}-${r.for_date}`} className="border-b last:border-0">
                      <td className="px-3 py-2 font-mono text-xs">{fmtDay(r.made_from)}</td>
                      <td className="px-3 py-2 font-mono text-xs">{fmtDay(r.for_date)}</td>
                      <td className="px-3 py-2">
                        <Link to="/pipeline/$id" params={{ id: r.pipeline }} className="font-mono text-xs hover:underline">
                          {r.pipelineName}
                        </Link>
                      </td>
                      <td className={cn("px-3 py-2 font-mono text-xs", r.alert && "font-semibold text-alert-ink")}>
                        {pct(r.risk)}
                      </td>
                      <td className="px-3 py-2 text-xs">{r.alert ? "Yes" : "No"}</td>
                      <td className="px-3 py-2">
                        <OutcomeBadge outcome={r.outcome} short />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-2 md:hidden">
              {rows.map((r) => (
                <MobileRow key={`${r.pipeline}-${r.for_date}`} r={r} />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function MobileRow({ r }: { r: TrackRow }) {
  return (
    <div className="panel flex items-center justify-between gap-3 p-3">
      <div className="min-w-0">
        <div className="font-mono text-xs font-semibold">{r.pipelineName}</div>
        <div className="font-mono text-[11px] text-muted-foreground">
          made {fmtDay(r.made_from)} → for {fmtDay(r.for_date)}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className={cn("font-mono text-sm", r.alert && "font-semibold text-alert-ink")}>
          {pct(r.risk)} {r.alert && <span className="text-[10px]">alert</span>}
        </span>
        <OutcomeBadge outcome={r.outcome} short />
      </div>
    </div>
  );
}

function Total({ label, value, tone }: { label: string; value: number; tone?: "ok" | "fail" | "alert" }) {
  return (
    <div className="panel px-3 py-2.5">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <CountUp
        value={value}
        format={(n) => Math.round(n).toString()}
        className={cn(
          "block text-2xl font-semibold",
          tone === "ok" && value > 0 && "text-ok-ink",
          tone === "fail" && value > 0 && "text-fail-ink",
          tone === "alert" && value > 0 && "text-alert-ink",
        )}
      />
    </div>
  );
}
