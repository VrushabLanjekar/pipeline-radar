import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronRight, XOctagon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAsOf } from "@/lib/dpfp/as-of";
import { addDays, fmtDay, fmtShort, pct } from "@/lib/dpfp/dates";
import { overviewBanner, overviewRows, type PipelineRow } from "@/lib/dpfp/overview";
import { dataQuery } from "@/lib/dpfp/queries";
import type { DpfpData } from "@/lib/dpfp/types";
import { QueryGate } from "@/components/radar/states";
import {
  Chip,
  CountUp,
  DaySquares,
  LowConfTag,
  RiskBar,
  SectionTitle,
  Sparkline,
  StatusChip,
} from "@/components/radar/primitives";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Overview · Pipeline Radar" },
      {
        name: "description",
        content: "Which data pipelines may fail on their next daily run, ranked by forecast risk.",
      },
      { property: "og:title", content: "Pipeline Radar: which pipelines break next" },
      {
        property: "og:description",
        content: "Daily failure forecasts for data pipelines from the DPFP research model.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OverviewPage,
});

function OverviewPage() {
  const q = useQuery(dataQuery);
  return <QueryGate query={q}>{(data) => <Overview data={data} />}</QueryGate>;
}

type Filter = "all" | "alert" | "ok" | "lowconf";

function Overview({ data }: { data: DpfpData }) {
  const { date } = useAsOf();
  const th = data.threshold;
  const rows = useMemo(() => overviewRows(data, date), [data, date]);
  const banner = overviewBanner(rows, date, th);
  const [filter, setFilter] = useState<Filter>("all");

  const failedN = rows.filter((r) => r.day?.s === "F").length;
  const riskN = rows.filter((r) => r.day && r.day.p >= th).length;
  const lift = data.horizon_scores.find((h) => h.days_ahead === 1)?.lift;

  const counts = {
    all: rows.length,
    alert: rows.filter((r) => r.status && r.status !== "ok").length,
    ok: rows.filter((r) => r.status === "ok").length,
    lowconf: rows.filter((r) => r.p.lowconf).length,
  };
  const shown = rows.filter((r) =>
    filter === "all"
      ? true
      : filter === "alert"
        ? r.status && r.status !== "ok"
        : filter === "ok"
          ? r.status === "ok"
          : r.p.lowconf,
  );

  return (
    <div className="space-y-6">
      <Banner tone={banner.tone} text={banner.text} date={date} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Pipelines watched" value={rows.length} format={(n) => Math.round(n).toString()} />
        <Kpi
          label={`Failed on ${fmtShort(date)}`}
          value={failedN}
          format={(n) => Math.round(n).toString()}
          tone={failedN ? "fail" : undefined}
        />
        <Kpi
          label="At risk next run"
          sub={`risk ≥ ${pct(th)} for ${fmtShort(addDays(date, 1))}`}
          value={riskN}
          format={(n) => Math.round(n).toString()}
          tone={riskN ? "alert" : undefined}
        />
        <Kpi
          label="Better than guessing"
          sub="1-day forecast vs base rate"
          value={lift ?? 0}
          format={(n) => (lift === undefined ? "–" : `${n.toFixed(1)}x`)}
        />
      </div>

      <section>
        <SectionTitle
          aside={
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
              {(
                [
                  ["all", "All"],
                  ["alert", "Alert"],
                  ["ok", "OK"],
                  ["lowconf", "Low confidence"],
                ] as const
              ).map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => setFilter(k)}
                  aria-pressed={filter === k}
                  className={cn(
                    "rounded-sm border px-2 py-1 text-xs transition-colors",
                    filter === k
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {l} <span className="font-mono opacity-70">{counts[k]}</span>
                </button>
              ))}
            </div>
          }
        >
          Pipelines by risk · as of <span className="font-mono">{fmtDay(date)}</span>
        </SectionTitle>
        {shown.length === 0 ? (
          <p className="panel px-4 py-8 text-center text-sm text-muted-foreground">
            No pipelines match this filter.
          </p>
        ) : (
          <>
            <PipelineTable rows={shown} th={th} date={date} />
            <PipelineCards rows={shown} th={th} date={date} />
          </>
        )}
      </section>
    </div>
  );
}

function Banner({ tone, text, date }: { tone: "fail" | "alert" | "ok"; text: string; date: string }) {
  const Icon = tone === "fail" ? XOctagon : tone === "alert" ? AlertTriangle : CheckCircle2;
  return (
    <div
      className={cn(
        "fade-up flex items-start gap-3 rounded-md border-l-4 px-4 py-3.5",
        tone === "fail" && "border-fail bg-fail-soft",
        tone === "alert" && "border-alert bg-alert-soft",
        tone === "ok" && "border-ok bg-ok-soft",
      )}
      role="status"
      aria-live="polite"
    >
      <Icon
        className={cn(
          "mt-0.5 size-5 shrink-0",
          tone === "fail" && "text-fail",
          tone === "alert" && "text-alert-ink",
          tone === "ok" && "text-ok-ink",
        )}
        aria-hidden
      />
      <div className="min-w-0">
        <p className="text-base font-medium leading-snug md:text-lg">{text}</p>
        <p className="mt-0.5 font-mono text-xs text-muted-foreground">as of {fmtDay(date)}</p>
      </div>
    </div>
  );
}

function Kpi({
  label,
  sub,
  value,
  format,
  tone,
}: {
  label: string;
  sub?: string;
  value: number;
  format: (n: number) => string;
  tone?: "fail" | "alert" | undefined;
}) {
  return (
    <div className="panel relative overflow-hidden px-4 py-3">
      {tone && (
        <span className={cn("absolute inset-y-0 left-0 w-1", tone === "fail" ? "bg-fail" : "bg-alert")} aria-hidden />
      )}
      <div className="label-caps">{label}</div>
      <CountUp
        value={value}
        format={format}
        className={cn(
          "mt-1 block text-3xl font-semibold tracking-tight",
          tone === "fail" && "text-fail-ink",
          tone === "alert" && "text-alert-ink",
        )}
      />
      {sub && <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function NextThree({ r, date, th }: { r: PipelineRow; date: string; th: number }) {
  if (!r.day) return <span className="text-muted-foreground">–</span>;
  const vals = [r.day.p, r.day.p2, r.day.p3];
  return (
    <div className="flex gap-3">
      {vals.map((v, i) => (
        <div key={i} className="leading-tight">
          <div className={cn("font-mono text-xs", v >= th ? "font-semibold text-alert-ink" : "")}>{pct(v)}</div>
          <div className="font-mono text-[10px] text-muted-foreground">{fmtShort(addDays(date, i + 1))}</div>
        </div>
      ))}
    </div>
  );
}

function NameCell({ r }: { r: PipelineRow }) {
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-1.5">
        <Link
          to="/pipeline/$id"
          params={{ id: r.p.id }}
          className="font-mono text-sm font-semibold hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {r.p.name}
        </Link>
        {r.changed && <Chip tone="solid">new</Chip>}
      </div>
      <div className="truncate text-xs text-muted-foreground">{r.p.source}</div>
    </div>
  );
}

function StatusCell({ r }: { r: PipelineRow }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {r.status ? <StatusChip status={r.status} /> : <Chip>No run</Chip>}
      {r.p.lowconf && <LowConfTag />}
    </div>
  );
}

function PipelineTable({ rows, th, date }: { rows: PipelineRow[]; th: number; date: string }) {
  const navigate = useNavigate();
  return (
    <div className="panel hidden overflow-hidden md:block">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/60">
          <tr className="text-left">
            {["Pipeline", "Status", "Next-run risk", "Next 3 days", "Likely problem", "Last 14 days", "30-day trend", ""].map(
              (h) => (
                <th key={h} className="label-caps px-3 py-2 font-semibold">
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.p.id}
              onClick={() => navigate({ to: "/pipeline/$id", params: { id: r.p.id } })}
              className="cursor-pointer border-b last:border-0 transition-colors hover:bg-muted/50"
            >
              <td className="max-w-56 px-3 py-3 align-top">
                <NameCell r={r} />
              </td>
              <td className="px-3 py-3 align-top">
                <StatusCell r={r} />
              </td>
              <td className="w-36 px-3 py-3 align-top">
                {r.day ? (
                  <>
                    <div className={cn("font-mono text-base font-semibold", r.day.p >= th && "text-alert-ink")}>
                      {pct(r.day.p)}
                    </div>
                    <RiskBar p={r.day.p} threshold={th} />
                  </>
                ) : (
                  "–"
                )}
              </td>
              <td className="px-3 py-3 align-top">
                <NextThree r={r} date={date} th={th} />
              </td>
              <td className="max-w-48 px-3 py-3 align-top text-xs">{r.day?.why[0] ?? <span className="text-muted-foreground">Nothing stands out</span>}</td>
              <td className="px-3 py-3 align-top">
                <DaySquares days={r.last14} />
              </td>
              <td className="px-3 py-3 align-top">
                <Sparkline values={r.spark} threshold={th} />
              </td>
              <td className="px-2 py-3 align-top text-muted-foreground">
                <ChevronRight className="size-4" aria-hidden />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PipelineCards({ rows, th, date }: { rows: PipelineRow[]; th: number; date: string }) {
  const navigate = useNavigate();
  return (
    <div className="space-y-3 md:hidden">
      {rows.map((r) => (
        <div
          key={r.p.id}
          role="link"
          tabIndex={0}
          onClick={() => navigate({ to: "/pipeline/$id", params: { id: r.p.id } })}
          onKeyDown={(e) => e.key === "Enter" && navigate({ to: "/pipeline/$id", params: { id: r.p.id } })}
          className="panel cursor-pointer space-y-3 p-3"
        >
          <div className="flex items-start justify-between gap-3">
            <NameCell r={r} />
            {r.day && (
              <div className={cn("shrink-0 font-mono text-xl font-semibold", r.day.p >= th && "text-alert-ink")}>
                {pct(r.day.p)}
              </div>
            )}
          </div>
          <StatusCell r={r} />
          {r.day && <RiskBar p={r.day.p} threshold={th} />}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="label-caps mb-1">Next 3 days</div>
              <NextThree r={r} date={date} th={th} />
            </div>
            <div>
              <div className="label-caps mb-1">Likely problem</div>
              {r.day?.why[0] ?? <span className="text-muted-foreground">Nothing stands out</span>}
            </div>
          </div>
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="label-caps mb-1">Last 14 days</div>
              <DaySquares days={r.last14} />
            </div>
            <Sparkline values={r.spark} threshold={th} width={80} />
          </div>
        </div>
      ))}
    </div>
  );
}
