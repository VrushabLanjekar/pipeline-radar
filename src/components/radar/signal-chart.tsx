import { useMemo } from "react";
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
import { fmtDay, fmtShort } from "@/lib/dpfp/dates";
import { SIGNALS, signalLevel } from "@/lib/dpfp/logic";
import type { Day } from "@/lib/dpfp/types";

export function fmtSignal(v: number): string {
  if (Math.abs(v) >= 100) return v.toFixed(0);
  if (Math.abs(v) >= 10) return v.toFixed(1);
  return v.toFixed(2);
}

export const LEVEL_LABEL = { normal: "normal", above: "above usual", high: "high" } as const;

export function SignalChart({
  days,
  index,
  norm,
  selected,
  onPin,
  height = 220,
}: {
  days: Day[];
  index: number;
  norm: [number, number];
  selected: string;
  onPin: (d: string) => void;
  height?: number;
}) {
  const reduced = useReducedMotion();
  const data = useMemo(() => days.map((d) => ({ d: d.d, v: d.sig[index] ?? 0 })), [days, index]);
  const yMax = Math.max(norm[1], ...data.map((x) => x.v)) * 1.1 || 1;

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 0, left: -8 }}
          onClick={(s: { activeLabel?: string | number } | null) => s?.activeLabel != null && onPin(String(s.activeLabel))}
          style={{ cursor: "pointer" }}
        >
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <ReferenceArea
            y1={norm[0]}
            y2={norm[1]}
            fill="var(--ok)"
            fillOpacity={0.09}
            label={{ value: "normal range", position: "insideTopLeft", fontSize: 10, fill: "var(--ok-ink)" }}
          />
          <ReferenceLine x={selected} stroke="var(--foreground)" />
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
            tickFormatter={(v: number) => fmtSignal(v)}
            tick={{ fontSize: 10, fontFamily: "var(--font-mono)", fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <Tooltip
            isAnimationActive={false}
            cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              const pt = active && payload?.[0]?.payload ? (payload[0].payload as { d: string; v: number }) : null;
              if (!pt) return null;
              const lvl = signalLevel(pt.v, norm);
              return (
                <div className="panel px-3 py-2 text-xs shadow-sm">
                  <div className="font-mono font-semibold">{fmtDay(pt.d)}</div>
                  <div className="mt-1 flex justify-between gap-4">
                    <span className="text-muted-foreground">{SIGNALS[index]}</span>
                    <span className="font-mono">{fmtSignal(pt.v)}</span>
                  </div>
                  <div className={lvl === "high" ? "text-alert-ink" : "text-muted-foreground"}>{LEVEL_LABEL[lvl]}</div>
                </div>
              );
            }}
          />
          <Line
            dataKey="v"
            stroke="var(--foreground)"
            strokeWidth={1.5}
            isAnimationActive={!reduced}
            animationDuration={600}
            dot={(props: { cx?: number; cy?: number; payload?: { v: number }; index?: number }) => {
              const { cx, cy, payload, index: i } = props;
              if (!payload || payload.v <= norm[1] || cx == null || cy == null) return <g key={`s${i}`} />;
              return <circle key={`s${i}`} cx={cx} cy={cy} r={3} fill="var(--alert)" stroke="var(--background)" strokeWidth={1} />;
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
