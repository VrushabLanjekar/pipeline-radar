import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAsOf } from "@/lib/dpfp/as-of";
import { addDays, fmtDay, fmtShort, pct } from "@/lib/dpfp/dates";
import {
  backtest,
  dayIndex,
  dayOutcome,
  dayStatus,
  failTypeWords,
  reasonSignal,
  runStatusWords,
  signalLevel,
  SIGNALS,
} from "@/lib/dpfp/logic";
import { dataQuery } from "@/lib/dpfp/queries";
import type { DpfpData, Pipeline } from "@/lib/dpfp/types";
import { QueryGate } from "@/components/radar/states";
import {
  Chip,
  CountUp,
  LowConfTag,
  OutcomeBadge,
  SectionTitle,
  Sparkline,
  StatusChip,
} from "@/components/radar/primitives";
import { RiskChart } from "@/components/radar/risk-chart";
import { fmtSignal, LEVEL_LABEL, SignalChart } from "@/components/radar/signal-chart";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/pipeline/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.id} pipeline forecast · Pipeline Radar` },
      {
        name: "description",
        content: `Next-run failure risk, 3-day outlook and warning history for the ${params.id} pipeline.`,
      },
      { property: "og:title", content: `${params.id} pipeline forecast · Pipeline Radar` },
      {
        property: "og:description",
        content: `Will the ${params.id} data pipeline fail on its next run? Risk, reasons and track record.`,
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PipelinePage,
});

function PipelinePage() {
  const { id } = Route.useParams();
  const q = useQuery(dataQuery);
  return (
    <QueryGate query={q}>
      {(data) => {
        const p = data.pipelines.find((x) => x.id === id);
        if (!p)
          return (
            <div className="py-20 text-center">
              <h1 className="text-lg font-semibold">No pipeline called “{id}”</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                It is not in today's data file.{" "}
                <Link to="/" className="underline">
                  Back to overview
                </Link>
              </p>
            </div>
          );
        return <PipelineView data={data} p={p} key={p.id} />;
      }}
    </QueryGate>
  );
}

function PipelineView({ data, p }: { data: DpfpData; p: Pipeline }) {
  const { date, pin, hover } = useAsOf();
  const th = data.threshold;
  const [line, setLine] = useState(th);
  const [compare, setCompare] = useState(false);
  const [signal, setSignal] = useState<number | null>(null);
  const other = data.pipelines.find((x) => x.id !== p.id);

  const idx = dayIndex(p, date);
  const day = idx >= 0 ? p.days[idx] : undefined;
  const status = day ? dayStatus(day, th) : null;
  const bt = useMemo(() => backtest(p.days, line), [p.days, line]);
  const horizon = (n: number) => data.horizon_scores.find((h) => h.days_ahead === n);

  const alertLog = useMemo(
    () =>
      p.days
        .map((d, i) => ({ d, i }))
        .filter(({ d }) => d.p >= line)
        .reverse(),
    [p.days, line],
  );

  return (
    <div className="space-y-6">
      <div>
        <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" aria-hidden /> Overview
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="font-mono text-xl font-semibold tracking-tight md:text-2xl">{p.name}</h1>
          {status && <StatusChip status={status} />}
          {p.lowconf && <LowConfTag />}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {p.source} · <span className="font-mono">{p.table}</span> · {p.owner}
        </p>
      </div>

      {p.lowconf && (
        <div className="flex items-start gap-2 rounded-md border bg-neutral-soft px-3 py-2.5 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>
            Low confidence: only <span className="font-mono font-semibold">{p.fail_total}</span> past failures to learn
            from. Treat these numbers as rough.
          </span>
        </div>
      )}

      {!day ? (
        <p className="panel px-4 py-8 text-center text-sm text-muted-foreground">
          No run recorded for {fmtDay(date)}. Use ← → or pick another date on the chart below.
        </p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-[1.1fr_2fr]">
          <div className={cn("panel relative overflow-hidden p-4", day.p >= th && "border-alert/60")}>
            {day.p >= th && <span className="absolute inset-y-0 left-0 w-1 bg-alert" aria-hidden />}
            <div className="label-caps">Risk for next run · {fmtDay(addDays(date, 1))}</div>
            <CountUp
              value={day.p}
              format={(n) => pct(n)}
              className={cn("mt-1 block text-5xl font-semibold tracking-tight", day.p >= th && "text-alert-ink")}
            />
            <div className="mt-2 font-mono text-xs text-muted-foreground">
              alert line <span className="text-foreground">{pct(th)}</span> ·{" "}
              {day.p >= th ? (
                <span className="text-alert-ink">{(day.p / th).toFixed(1)}x the line</span>
              ) : (
                <span>below the line</span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[day.p, day.p2, day.p3].map((v, i) => {
              const h = horizon(i + 1);
              return (
                <div key={i} className={cn("panel p-3", v >= th && "bg-alert-soft border-alert/40")}>
                  <div className="label-caps">{i === 0 ? "1 day" : `${i + 1} days`}</div>
                  <div className="font-mono text-xs text-muted-foreground">{fmtDay(addDays(date, i + 1))}</div>
                  <div className={cn("mt-2 font-mono text-2xl font-semibold", v >= th && "text-alert-ink")}>{pct(v)}</div>
                  <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                    {h ? `${h.lift.toFixed(1)}x vs guessing` : "–"}
                  </div>
                  {i > 0 && <div className="mt-0.5 text-[11px] text-muted-foreground">Lower confidence</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <section className="panel p-4">
        <SectionTitle
          aside={
            other && (
              <div className="flex items-center gap-2">
                <Switch id="compare" checked={compare} onCheckedChange={setCompare} />
                <Label htmlFor="compare" className="text-xs font-normal text-muted-foreground">
                  Compare with {other.name}
                </Label>
              </div>
            )
          }
        >
          Risk of failing the next day · last {p.days.length} days
        </SectionTitle>
        <RiskChart
          days={p.days}
          other={compare ? other?.days : undefined}
          otherName={other?.name}
          threshold={line}
          selected={date}
          onHover={hover}
          onPin={pin}
        />
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <Legend swatch="h-0.5 w-4 bg-foreground" label={p.name} />
          {compare && other && <Legend swatch="h-0.5 w-4 bg-neutral" label={other.name} />}
          <Legend swatch="h-0 w-4 border-t-2 border-dashed border-alert" label="alert line" />
          <Legend swatch="size-2 rounded-full bg-fail" label="failed run" />
          <span className="ml-auto hidden sm:inline">Hover to preview a date, click or drag to pin it</span>
        </div>

        <div className="mt-6 border-t pt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="label-caps">Try another alert line</div>
            <div className="font-mono text-sm">
              <span className="font-semibold">{pct(line)}</span>
              {Math.abs(line - th) > 0.0005 && (
                <button className="ml-2 text-xs text-muted-foreground underline" onClick={() => setLine(th)}>
                  reset to {pct(th)}
                </button>
              )}
            </div>
          </div>
          <div className="relative mt-3 pb-5">
            <Slider
              min={0.03}
              max={0.3}
              step={0.001}
              value={[line]}
              onValueChange={(v) => setLine(v[0] ?? th)}
              aria-label="Alert line"
            />
            <div
              className="absolute top-5 -translate-x-1/2 text-center font-mono text-[10px] text-muted-foreground"
              style={{ left: `${((th - 0.03) / 0.27) * 100}%` }}
            >
              <div className="mx-auto h-1.5 w-px bg-muted-foreground" />
              default
            </div>
            <div className="absolute top-5 left-0 font-mono text-[10px] text-muted-foreground">3%</div>
            <div className="absolute top-5 right-0 font-mono text-[10px] text-muted-foreground">30%</div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Counter label="Failures warned" value={`${bt.warned} of ${bt.failures}`} tone="ok" />
            <Counter label="Failures missed" value={String(bt.missed)} tone={bt.missed ? "fail" : undefined} />
            <Counter label="False alarms / month" value={bt.falseAlarmsPerMonth.toFixed(1)} tone={bt.falseAlarms ? "alert" : undefined} />
            <Counter label="Alert days" value={`${bt.alertDays} of ${p.days.length}`} />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Days before the forecast log started were scored afterwards by the current model, so these counts are
            optimistic. See{" "}
            <Link to="/track-record" className="underline">
              Track record
            </Link>{" "}
            for as-made forecasts.
          </p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <DayPanel p={p} idx={idx} th={th} onReason={setSignal} />
        <section className="panel p-4">
          <SectionTitle>Signals on {fmtDay(date)}</SectionTitle>
          {signal !== null ? (
            <div className="mb-4 fade-up">
              <div className="mb-1 flex items-center justify-between">
                <div className="text-sm font-medium">{SIGNALS[signal]}</div>
                <button className="text-xs text-muted-foreground underline" onClick={() => setSignal(null)}>
                  Close
                </button>
              </div>
              <SignalChart days={p.days} index={signal} norm={p.norm[signal] ?? [0, 0]} selected={date} onPin={pin} />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Shaded band = normal range ({fmtSignal(p.norm[signal]?.[0] ?? 0)} to {fmtSignal(p.norm[signal]?.[1] ?? 0)}). Amber dots
                = high days.
              </p>
            </div>
          ) : (
            <p className="mb-3 text-xs text-muted-foreground">Click a reason or a signal to open its chart.</p>
          )}
          <div className="grid grid-cols-2 gap-2">
            {SIGNALS.map((name, i) => {
              const v = day?.sig[i];
              const norm = p.norm[i] ?? [0, 0];
              const lvl = v !== undefined ? signalLevel(v, norm) : null;
              const series = p.days.slice(Math.max(0, idx - 29), idx + 1).map((d) => d.sig[i] ?? 0);
              return (
                <button
                  key={name}
                  onClick={() => setSignal(i)}
                  className={cn(
                    "rounded-sm border p-2 text-left transition-colors hover:bg-muted/60",
                    signal === i && "border-foreground",
                  )}
                >
                  <div className="text-xs text-muted-foreground">{name}</div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-semibold">{v !== undefined ? fmtSignal(v) : "–"}</span>
                    {lvl && (
                      <Chip tone={lvl === "high" ? "alert" : lvl === "above" ? "outline" : "neutral"}>
                        {LEVEL_LABEL[lvl]}
                      </Chip>
                    )}
                  </div>
                  <Sparkline values={series} threshold={norm[1]} width={140} height={22} className="mt-1 w-full" />
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <section className="panel p-4">
        <SectionTitle aside={<span className="font-mono text-xs text-muted-foreground">at alert line {pct(line)}</span>}>
          Alert log · {alertLog.length} alert days
        </SectionTitle>
        {alertLog.length === 0 ? (
          <p className="text-sm text-muted-foreground">No day in this window crossed the alert line.</p>
        ) : (
          <ul className="max-h-80 divide-y overflow-y-auto">
            {alertLog.map(({ d, i }) => (
              <li key={d.d}>
                <button
                  onClick={() => pin(d.d)}
                  className={cn(
                    "flex w-full flex-wrap items-center justify-between gap-2 px-1 py-2 text-left text-sm hover:bg-muted/50",
                    d.d === date && "bg-muted",
                  )}
                >
                  <span className="font-mono text-xs">
                    {fmtDay(d.d)} <span className="text-muted-foreground">→ for {fmtShort(addDays(d.d, 1))}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-mono text-xs text-alert-ink">{pct(d.p)}</span>
                    <OutcomeBadge outcome={dayOutcome(p.days, i, line)} short />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={swatch} aria-hidden />
      {label}
    </span>
  );
}

function Counter({ label, value, tone }: { label: string; value: string; tone?: "ok" | "fail" | "alert" | undefined }) {
  return (
    <div className="rounded-sm border px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div
        className={cn(
          "font-mono text-xl font-semibold",
          tone === "ok" && "text-ok-ink",
          tone === "fail" && "text-fail-ink",
          tone === "alert" && "text-alert-ink",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function DayPanel({
  p,
  idx,
  th,
  onReason,
}: {
  p: Pipeline;
  idx: number;
  th: number;
  onReason: (i: number) => void;
}) {
  const { date } = useAsOf();
  const day = idx >= 0 ? p.days[idx] : undefined;
  if (!day)
    return (
      <section className="panel p-4">
        <SectionTitle>{fmtDay(date)}</SectionTitle>
        <p className="text-sm text-muted-foreground">No run recorded on this date.</p>
      </section>
    );
  const outcome = dayOutcome(p.days, idx, th);
  const tw = failTypeWords(day.t);
  return (
    <section className="panel p-4">
      <SectionTitle
        aside={
          <Chip tone="outline">{day.logged ? "Saved that morning" : "Scored afterwards"}</Chip>
        }
      >
        Day panel · <span className="font-mono">{fmtDay(date)}</span>
      </SectionTitle>
      <dl className="space-y-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <dt className="text-muted-foreground">Run on {fmtShort(date)}</dt>
          <dd
            className={cn(
              "font-medium",
              day.s === "F" && "text-fail-ink",
              day.s === "S" && "text-ok-ink",
            )}
          >
            {runStatusWords(day.s)}
            {tw && `: ${tw}`} · <span className="font-mono text-xs text-muted-foreground">{day.rows} rows</span>
          </dd>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <dt className="text-muted-foreground">Forecast for {fmtDay(addDays(date, 1))}</dt>
          <dd className="flex items-center gap-2">
            <span className={cn("font-mono", day.p >= th && "font-semibold text-alert-ink")}>{pct(day.p)}</span>
            <span className="text-xs text-muted-foreground">{day.p >= th ? "alert" : "no alert"}</span>
          </dd>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <dt className="text-muted-foreground">Outcome</dt>
          <dd>
            <OutcomeBadge outcome={outcome} />
          </dd>
        </div>
      </dl>
      <div className="mt-4">
        <div className="label-caps mb-2">What pushed the risk up</div>
        {day.why.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing unusual.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {day.why.map((w) => {
              const s = reasonSignal(w);
              return s === null ? (
                <Chip key={w} tone="neutral">
                  {w}
                </Chip>
              ) : (
                <button
                  key={w}
                  onClick={() => onReason(s)}
                  className="inline-flex items-center gap-1 rounded-sm border border-foreground/30 px-1.5 py-0.5 text-xs font-medium transition-colors hover:border-foreground hover:bg-foreground hover:text-background"
                >
                  {w} <span aria-hidden>↗</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
