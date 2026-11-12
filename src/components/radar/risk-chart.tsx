import { useMemo, useRef } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { addDays, fmtDay, fmtShort, pct } from "@/lib/dpfp/dates";
import { failTypeWords, runStatusWords } from "@/lib/dpfp/logic";
import type { Day } from "@/lib/dpfp/types";

interface Point {
  d: string;
  p: number;
  other?: number | undefined;
  s: Day["s"];
  t: Day["t"];
  why: string[];
}

type ChartState = { activeLabel?: string | number } | null | undefined;

export function RiskChart({
  days,
  other,
  otherName,
  threshold,
  selected,
  onHover,
  onPin,
  height = 280,
}: {
  days: Day[];
  other?: Day[] | undefined;
  otherName?: string | undefined;
  threshold: number;
  selected: string;
  onHover: (d: string | null) => void;
  onPin: (d: string) => void;
  height?: number;
}) {
  const reduced = useReducedMotion();
  const dragging = useRef(false);

  const data = useMemo<Point[]>(() => {
    const om = new Map((other ?? []).map((d) => [d.d, d.p]));
    return days.map((d) => ({ d: d.d, p: d.p, other: om.get(d.d), s: d.s, t: d.t, why: d.why }));
  }, [days, other]);

  const yMax = useMemo(() => {
    const m = Math.max(threshold, ...data.map((x) => Math.max(x.p, x.other ?? 0)));
    return Math.min(1, Math.ceil((m * 1.15) / 0.05) * 0.05);
  }, [data, threshold]);

  const failures = data.filter((x) => x.s === "F");
  const label = (s: ChartState) => (s?.activeLabel != null ? String(s.activeLabel) : null);

  return (
    <div className="select-none" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 0, left: -12 }}
          onMouseDown={(s: ChartState) => {
            const l = label(s);
            if (l) {
              dragging.current = true;
              onPin(l);
            }
          }}
          onMouseMove={(s: ChartState) => {
            const l = label(s);
            if (!l) return;
            if (dragging.current) onPin(l);
            else onHover(l);
          }}
          onMouseUp={() => (dragging.current = false)}
          onMouseLeave={() => {
            dragging.current = false;
            onHover(null);
          }}
          onClick={(s: ChartState) => {
            const l = label(s);
            if (l) onPin(l);
          }}
          style={{ cursor: "crosshair" }}
        >
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          {data.length > 1 && (
            <ReferenceArea x1={data[0]!.d} x2={data[data.length - 1]!.d} y1={threshold} y2={yMax} fill="var(--alert)" fillOpacity={0.1} stroke="none" />
          )}
          {failures.map((f) => (
            <ReferenceLine key={f.d} x={f.d} stroke="var(--fail)" strokeOpacity={0.22} strokeWidth={5} />
          ))}
          <ReferenceLine
            y={threshold}
            stroke="var(--alert)"
            strokeDasharray="5 4"
            strokeWidth={1.5}
            label={{
              value: `alert line ${pct(threshold)}`,
              position: "insideTopRight",
              fill: "var(--alert-ink)",
              fontSize: 10,
              fontFamily: "var(--font-mono)",
            }}
          />
          <ReferenceLine x={selected} stroke="var(--foreground)" strokeWidth={1} />
          <XAxis
            dataKey="d"
            tickFormatter={fmtShort}
            tick={{ fontSize: 10, fontFamily: "var(--font-mono)", fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            minTickGap={36}
          />
          <YAxis
            domain={[0, yMax]}
            tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
            tick={{ fontSize: 10, fontFamily: "var(--font-mono)", fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Tooltip
            cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
            isAnimationActive={false}
            content={({ active, payload }) => {
              const pt = active && payload?.[0]?.payload ? (payload[0].payload as Point) : null;
              if (!pt) return null;
              const tw = failTypeWords(pt.t);
              return (
                <div className="panel min-w-48 px-3 py-2 text-xs shadow-sm">
                  <div className="font-mono font-semibold">{fmtDay(pt.d)}</div>
                  <div className="mt-1 flex justify-between gap-4">
                    <span className="text-muted-foreground">Risk for {fmtShort(addDays(pt.d, 1))}</span>
                    <span className={pt.p >= threshold ? "font-mono font-semibold text-alert-ink" : "font-mono"}>
                      {pct(pt.p)}
                    </span>
                  </div>
                  {pt.other !== undefined && (
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">{otherName}</span>
                      <span className="font-mono text-muted-foreground">{pct(pt.other)}</span>
                    </div>
                  )}
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Run</span>
                    <span className={pt.s === "F" ? "font-medium text-fail-ink" : ""}>
                      {runStatusWords(pt.s)}
                      {tw && `: ${tw}`}
                    </span>
                  </div>
                  {pt.why[0] && <div className="mt-1 text-muted-foreground">Top reason: {pt.why[0]}</div>}
                </div>
              );
            }}
          />
          {other && (
            <Line
              dataKey="other"
              stroke="var(--neutral)"
              strokeWidth={1.25}
              dot={false}
              activeDot={false}
              isAnimationActive={!reduced}
              animationDuration={600}
            />
          )}
          <Line
            dataKey="p"
            stroke="var(--foreground)"
            strokeWidth={1.75}
            isAnimationActive={!reduced}
            animationDuration={900}
            activeDot={{ r: 3.5, fill: "var(--foreground)", stroke: "var(--background)", strokeWidth: 2 }}
            dot={(props: { cx?: number; cy?: number; payload?: Point; index?: number }) => {
              const { cx, cy, payload, index } = props;
              if (!payload || payload.s !== "F" || cx == null || cy == null)
                return <g key={`d${index}`} />;
              return <circle key={`d${index}`} cx={cx} cy={cy} r={3.5} fill="var(--fail)" stroke="var(--background)" strokeWidth={1.5} />;
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
