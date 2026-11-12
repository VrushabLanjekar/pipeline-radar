import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { fmtDay, fmtShort, pct } from "@/lib/dpfp/dates";
import { dataQuery } from "@/lib/dpfp/queries";
import type { DpfpData } from "@/lib/dpfp/types";
import { QueryGate } from "@/components/radar/states";
import { CountUp, SectionTitle } from "@/components/radar/primitives";

export const Route = createFileRoute("/model")({
  head: () => ({
    meta: [
      { title: "Model · Pipeline Radar" },
      {
        name: "description",
        content: "How good the DPFP failure forecast is 1, 2 and 3 days ahead, and how it is built.",
      },
      { property: "og:title", content: "The DPFP forecasting model · Pipeline Radar" },
      {
        property: "og:description",
        content: "Forecast quality, weekly retrain history and the alert line explained.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ModelPage,
});

function ModelPage() {
  const q = useQuery(dataQuery);
  return <QueryGate query={q}>{(data) => <Model data={data} />}</QueryGate>;
}

function Model({ data }: { data: DpfpData }) {
  const reduced = useReducedMotion();
  const hs = [...data.horizon_scores].sort((a, b) => a.days_ahead - b.days_ahead);
  const perf = [...data.performance].sort((a, b) => (a.retrain_date < b.retrain_date ? -1 : 1));
  const low = data.pipelines.filter((p) => p.lowconf);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Model</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A Random Forest trained on every past daily run. Last trained{" "}
          <span className="font-mono text-foreground">{fmtDay(data.model_trained)}</span>.
        </p>
      </div>

      <section>
        <SectionTitle>Forecast quality on held-out test days</SectionTitle>
        <div className="grid gap-3 md:grid-cols-3">
          {hs.map((h) => (
            <div key={h.days_ahead} className="panel p-4">
              <div className="label-caps">{h.days_ahead === 1 ? "1 day ahead" : `${h.days_ahead} days ahead`}</div>
              <div className="mt-1 flex items-baseline gap-2">
                <CountUp value={h.lift} format={(n) => `${n.toFixed(1)}x`} className="text-4xl font-semibold" />
                <span className="text-sm text-muted-foreground">better than guessing</span>
              </div>
              <div className="mt-3 space-y-1.5">
                <Bar label="PR-AUC" value={h.test_PR_AUC} max={Math.max(...hs.map((x) => x.test_PR_AUC))} strong />
                <Bar label="Base rate" value={h.base_rate} max={Math.max(...hs.map((x) => x.test_PR_AUC))} />
              </div>
              <div className="mt-3 font-mono text-[11px] text-muted-foreground">
                ROC-AUC {h.test_ROC_AUC.toFixed(3)} · {h.test_failures} failures in {h.n_rows} test rows
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          “Better than guessing” = PR-AUC ÷ base rate. Guessing at random scores the base rate, so 1.0x means no skill.
        </p>
      </section>

      <section className="panel p-4">
        <SectionTitle>Weekly retrain history · test PR-AUC vs base rate</SectionTitle>
        {perf.length < 2 ? (
          <p className="text-sm text-muted-foreground">Not enough retrains yet to draw a line.</p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={perf} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                <CartesianGrid stroke="var(--grid)" vertical={false} />
                <XAxis
                  dataKey="retrain_date"
                  tickFormatter={fmtShort}
                  tick={{ fontSize: 10, fontFamily: "var(--font-mono)", fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                />
                <YAxis
                  domain={[0, "auto"]}
                  tickFormatter={(v: number) => v.toFixed(2)}
                  tick={{ fontSize: 10, fontFamily: "var(--font-mono)", fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                />
                <Tooltip
                  labelFormatter={(l) => `Retrained ${fmtDay(String(l))}`}
                  formatter={(v: number, n: string) => [v.toFixed(3), n]}
                  contentStyle={{ fontFamily: "var(--font-mono)", fontSize: 12, borderColor: "var(--border)" }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  name="Test PR-AUC"
                  dataKey="test_PR_AUC"
                  stroke="var(--foreground)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  isAnimationActive={!reduced}
                />
                <Line
                  name="Base rate"
                  dataKey="base_rate"
                  stroke="var(--neutral)"
                  strokeDasharray="4 3"
                  strokeWidth={1.5}
                  dot={{ r: 2.5 }}
                  isAnimationActive={!reduced}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          {perf.length} retrains so far. Each point is scored on days the model had not seen.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel p-4">
          <SectionTitle>The alert line</SectionTitle>
          <div className="font-mono text-3xl font-semibold text-alert-ink">{pct(data.threshold)}</div>
          <p className="mt-2 text-sm text-muted-foreground">
            A pipeline gets an alert when its risk for the next run is at or above this line. It is picked from past
            data to balance catching failures against raising false alarms: lower it and you catch more failures but
            get more false alarms. You can try other lines on any pipeline page.
          </p>
        </section>
        <section className="panel p-4">
          <SectionTitle>How it works</SectionTitle>
          <ol className="space-y-2 text-sm">
            {[
              ["08:00 IST", "Each pipeline fetches yesterday's air-quality data from its source API."],
              ["Checks", "Data checks look for missing rows, broken values, drift and a slow source."],
              ["Forecast", "The model scores the risk that each of the next 3 runs fails."],
              ["Sunday", "The model is retrained every week on all runs so far."],
            ].map(([k, v]) => (
              <li key={k} className="flex gap-3">
                <span className="w-20 shrink-0 font-mono text-xs font-semibold leading-5">{k}</span>
                <span className="text-muted-foreground">{v}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {low.length > 0 && (
        <section className="rounded-md border bg-neutral-soft p-4 text-sm">
          <div className="label-caps mb-1">Low confidence</div>
          {low.map((p) => (
            <p key={p.id}>
              <span className="font-mono font-semibold">{p.name}</span> has only{" "}
              <span className="font-mono">{p.fail_total}</span> failures in{" "}
              <span className="font-mono">{p.n_total}</span> runs. With so few examples the model cannot learn what a
              failure looks like for this pipeline, so its forecasts are shown but should be read as rough.
            </p>
          ))}
        </section>
      )}
    </div>
  );
}

function Bar({ label, value, max, strong }: { label: string; value: number; max: number; strong?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 shrink-0 text-muted-foreground">{label}</span>
      <div className="h-1.5 flex-1 rounded-full bg-neutral-soft">
        <div
          className={strong ? "h-full rounded-full bg-foreground" : "h-full rounded-full bg-neutral"}
          style={{ width: `${(value / max) * 100}%` }}
        />
      </div>
      <span className="w-12 text-right font-mono">{value.toFixed(3)}</span>
    </div>
  );
}
