import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useAsOf } from "@/lib/dpfp/as-of";
import { addDays, diffDays, fmtLong, monthName, toISO, toUTC, weekdayIndexMon } from "@/lib/dpfp/dates";
import { failTypeWords, runStatusWords } from "@/lib/dpfp/logic";
import { dataQuery, historyQuery } from "@/lib/dpfp/queries";
import type { DpfpData, HistoryRun, Pipeline } from "@/lib/dpfp/types";
import { QueryGate } from "@/components/radar/states";
import { LowConfTag, SectionTitle } from "@/components/radar/primitives";

export const Route = createFileRoute("/calendar")({
  head: () => ({
    meta: [
      { title: "Run calendar · Pipeline Radar" },
      { name: "description", content: "Every daily pipeline run on one calendar: clean, warning, failed or missing." },
      { property: "og:title", content: "Pipeline run calendar · Pipeline Radar" },
      { property: "og:description", content: "A heatmap of every daily data pipeline run and its outcome." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CalendarPage,
});

function CalendarPage() {
  const q = useQuery(dataQuery);
  return <QueryGate query={q}>{(data) => <CalendarView data={data} />}</QueryGate>;
}

function CalendarView({ data }: { data: DpfpData }) {
  const [id, setId] = useState(data.pipelines[0]?.id);
  const p = data.pipelines.find((x) => x.id === id) ?? data.pipelines[0];
  if (!p) return <p className="py-20 text-center text-sm text-muted-foreground">No pipelines in the data file.</p>;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Run calendar</h1>
          <p className="mt-1 text-sm text-muted-foreground">Every daily run, one square per day.</p>
        </div>
        <div className="flex gap-1.5" role="group" aria-label="Pipeline">
          {data.pipelines.map((x) => (
            <button
              key={x.id}
              onClick={() => setId(x.id)}
              aria-pressed={x.id === p.id}
              className={cn(
                "rounded-sm border px-2.5 py-1.5 font-mono text-xs transition-colors",
                x.id === p.id ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {x.name}
            </button>
          ))}
        </div>
      </div>
      <History p={p} key={p.id} />
    </div>
  );
}

function History({ p }: { p: Pipeline }) {
  const q = useQuery(historyQuery(p));
  return (
    <QueryGate query={q} title="Could not load the run history" loadingLabel={`Loading every run of ${p.name}`}>
      {(runs) => <Heatmap p={p} runs={runs} />}
    </QueryGate>
  );
}

const CELL = 11;
const STEP = 13;
const FILL: Record<string, string> = { F: "var(--fail)", W: "var(--warn-cell)", S: "var(--ok)" };

function Heatmap({ p, runs }: { p: Pipeline; runs: HistoryRun[] }) {
  const { pin } = useAsOf();
  const navigate = useNavigate();
  const [hover, setHover] = useState<{ d: string; run?: HistoryRun | undefined } | null>(null);
  const recent = useMemo(() => new Set(p.days.map((d) => d.d)), [p.days]);
  const byDate = useMemo(() => new Map(runs.map((r) => [r.d, r])), [runs]);

  const years = useMemo(() => {
    if (!runs.length) return [];
    const first = runs[0]!.d;
    const last = runs[runs.length - 1]!.d;
    const y0 = toUTC(first).getUTCFullYear();
    const y1 = toUTC(last).getUTCFullYear();
    const out: { year: number; start: string; end: string; counts: Record<"F" | "W" | "S", number> }[] = [];
    for (let y = y1; y >= y0; y--) {
      const start = y === y0 ? `${first.slice(0, 7)}-01` : `${y}-01-01`;
      const end =
        y === y1 ? toISO(new Date(Date.UTC(y, toUTC(last).getUTCMonth() + 1, 0))) : `${y}-12-31`;
      const counts = { F: 0, W: 0, S: 0 };
      for (const r of runs) if (r.d.startsWith(String(y))) counts[r.s]++;
      out.push({ year: y, start, end, counts });
    }
    return out;
  }, [runs]);

  const totals = runs.reduce((a, r) => ((a[r.s] += 1), a), { F: 0, W: 0, S: 0 });

  function open(d: string) {
    pin(d);
    navigate({ to: "/pipeline/$id", params: { id: p.id } });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <span className="font-mono">
          {runs.length} runs · {fmtLong(runs[0]?.d ?? "")} to {fmtLong(runs[runs.length - 1]?.d ?? "")}
        </span>
        {p.lowconf && <LowConfTag />}
        <span className="ml-auto flex flex-wrap items-center gap-3">
          <Key fill="var(--ok)" label={`Clean ${totals.S}`} />
          <Key fill="var(--warn-cell)" label={`Warning ${totals.W}`} />
          <Key fill="var(--fail)" label={`Failed ${totals.F}`} />
          <Key fill="var(--empty-cell)" label="No run" />
        </span>
      </div>

      <div className="panel min-h-11 px-3 py-2 font-mono text-xs" aria-live="polite">
        {hover ? (
          <>
            <span className="font-semibold">{fmtLong(hover.d)}</span>
            {" · "}
            <span className={hover.run?.s === "F" ? "text-fail-ink" : ""}>
              {runStatusWords(hover.run?.s)}
              {hover.run?.s === "F" && failTypeWords(hover.run.type) ? `: ${failTypeWords(hover.run.type)}` : ""}
            </span>
            {recent.has(hover.d) && <span className="text-muted-foreground"> · click to open this day</span>}
          </>
        ) : (
          <span className="text-muted-foreground">
            Hover a square for details. Squares in the last {p.days.length} days open that day on the pipeline page.
          </span>
        )}
      </div>

      {years.map((y) => {
        const startMon = addDays(y.start, -weekdayIndexMon(y.start));
        const cols = Math.floor(diffDays(y.end, startMon) / 7) + 1;
        const cells: string[] = [];
        for (let d = y.start; d <= y.end; d = addDays(d, 1)) cells.push(d);
        const months = cells.filter((d) => d.endsWith("-01"));
        const w = 24 + cols * STEP;
        const h = 16 + 7 * STEP;
        return (
          <section key={y.year} className="panel p-4">
            <SectionTitle
              aside={
                <span className="flex gap-3 font-mono text-xs">
                  <span className="text-ok-ink">{y.counts.S} clean</span>
                  <span className="text-alert-ink">{y.counts.W} warning</span>
                  <span className="text-fail-ink">{y.counts.F} failed</span>
                </span>
              }
            >
              <span className="font-mono text-sm text-foreground">{y.year}</span>
            </SectionTitle>
            <div className="overflow-x-auto">
              <svg width={w} height={h} className="block" role="img" aria-label={`Runs in ${y.year}`}>
                {months.map((m) => (
                  <text
                    key={m}
                    x={24 + Math.floor(diffDays(m, startMon) / 7) * STEP}
                    y={10}
                    fontSize={10}
                    fill="var(--muted-foreground)"
                    fontFamily="var(--font-mono)"
                  >
                    {monthName(toUTC(m).getUTCMonth())}
                  </text>
                ))}
                {["Mon", "", "Wed", "", "Fri", "", ""].map((l, i) => (
                  <text
                    key={i}
                    x={0}
                    y={16 + i * STEP + 9}
                    fontSize={9}
                    fill="var(--muted-foreground)"
                    fontFamily="var(--font-mono)"
                  >
                    {l}
                  </text>
                ))}
                {cells.map((d) => {
                  const run = byDate.get(d);
                  const col = Math.floor(diffDays(d, startMon) / 7);
                  const row = weekdayIndexMon(d);
                  const clickable = recent.has(d);
                  return (
                    <rect
                      key={d}
                      x={24 + col * STEP}
                      y={16 + row * STEP}
                      width={CELL}
                      height={CELL}
                      rx={2}
                      fill={run ? FILL[run.s] : "var(--empty-cell)"}
                      className={cn(clickable ? "cursor-pointer" : "", "transition-opacity hover:opacity-70")}
                      stroke={hover?.d === d ? "var(--foreground)" : "none"}
                      strokeWidth={1.5}
                      onMouseEnter={() => setHover({ d, run })}
                      onClick={() => (clickable ? open(d) : setHover({ d, run }))}
                    >
                      <title>{`${fmtLong(d)} · ${runStatusWords(run?.s)}${run?.s === "F" && failTypeWords(run.type) ? `: ${failTypeWords(run.type)}` : ""}`}</title>
                    </rect>
                  );
                })}
              </svg>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Key({ fill, label }: { fill: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <svg width="10" height="10" aria-hidden>
        <rect width="10" height="10" rx="2" fill={fill} />
      </svg>
      {label}
    </span>
  );
}
