import { useEffect, useRef, useState, type ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { fmtDay } from "@/lib/dpfp/dates";
import { runStatusWords, type Outcome, type Status } from "@/lib/dpfp/logic";
import type { Day } from "@/lib/dpfp/types";

export const chipVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm border px-1.5 py-0.5 text-xs font-medium leading-4",
  {
    variants: {
      tone: {
        fail: "border-fail/30 bg-fail-soft text-fail-ink",
        alert: "border-alert/40 bg-alert-soft text-alert-ink",
        ok: "border-ok/30 bg-ok-soft text-ok-ink",
        neutral: "border-border bg-neutral-soft text-muted-foreground",
        outline: "border-border bg-background text-foreground",
        solid: "border-foreground bg-foreground text-background",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Chip({
  tone,
  className,
  children,
  dot,
}: VariantProps<typeof chipVariants> & { className?: string; children: ReactNode; dot?: boolean }) {
  return (
    <span className={cn(chipVariants({ tone }), className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

const STATUS_LABEL: Record<Status, string> = { failed: "Failed", alert: "Alert", ok: "OK" };
const STATUS_TONE: Record<Status, "fail" | "alert" | "ok"> = {
  failed: "fail",
  alert: "alert",
  ok: "ok",
};

export function StatusChip({ status }: { status: Status }) {
  return (
    <Chip tone={STATUS_TONE[status]} dot>
      {STATUS_LABEL[status]}
    </Chip>
  );
}

export function LowConfTag() {
  return <Chip tone="neutral">Low confidence</Chip>;
}

export const OUTCOME_META: Record<Outcome, { label: string; tone: "ok" | "fail" | "alert" | "neutral" | "outline" }> = {
  hit: { label: "Warning came true", tone: "ok" },
  missed: { label: "Missed", tone: "fail" },
  false_alarm: { label: "False alarm", tone: "alert" },
  quiet: { label: "Correctly quiet", tone: "neutral" },
  pending: { label: "Outcome not known yet", tone: "outline" },
};

export function OutcomeBadge({ outcome, short }: { outcome: Outcome; short?: boolean }) {
  const m = OUTCOME_META[outcome];
  const label = short
    ? { hit: "Came true", missed: "Missed", false_alarm: "False alarm", quiet: "Quiet", pending: "Pending" }[outcome]
    : m.label;
  return <Chip tone={m.tone}>{label}</Chip>;
}

/** Counts up from zero on first mount only; later changes apply instantly. */
export function CountUp({
  value,
  format,
  className,
  duration = 900,
}: {
  value: number;
  format: (n: number) => string;
  className?: string;
  duration?: number;
}) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState<number | null>(null);
  const done = useRef(false);

  useEffect(() => {
    if (done.current || reduced) {
      done.current = true;
      setShown(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(value * eased);
      if (k < 1) raf = requestAnimationFrame(tick);
      else done.current = true;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      done.current = true;
      setShown(value);
    };
  }, [value, reduced, duration]);

  return <span className={cn("font-mono", className)}>{format(shown ?? value)}</span>;
}

export function Sparkline({
  values,
  threshold,
  max,
  className,
  width = 96,
  height = 24,
}: {
  values: number[];
  threshold?: number | undefined;
  max?: number | undefined;
  className?: string | undefined;
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return null;
  const hi = Math.max(max ?? 0, ...values, threshold ?? 0) || 1;
  const lo = Math.min(0, ...values);
  const x = (i: number) => (i / (values.length - 1)) * width;
  const y = (v: number) => height - 1 - ((v - lo) / (hi - lo)) * (height - 2);
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const last = values[values.length - 1] ?? 0;
  const over = threshold !== undefined && last >= threshold;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden>
      {threshold !== undefined && (
        <line x1={0} x2={width} y1={y(threshold)} y2={y(threshold)} stroke="var(--alert)" strokeDasharray="2 2" strokeWidth={1} />
      )}
      <path d={d} fill="none" stroke="var(--foreground)" strokeWidth={1.25} strokeLinejoin="round" />
      <circle cx={x(values.length - 1)} cy={y(last)} r={2.25} fill={over ? "var(--alert)" : "var(--foreground)"} />
    </svg>
  );
}

const SQUARE: Record<string, string> = {
  F: "bg-fail",
  W: "bg-warn-cell",
  S: "bg-ok",
};

export function DaySquares({ days, size = "sm" }: { days: (Day | undefined)[]; size?: "sm" | "md" }) {
  return (
    <div className="flex gap-[3px]">
      {days.map((d, i) => (
        <span
          key={d?.d ?? i}
          title={d ? `${fmtDay(d.d)} · ${runStatusWords(d.s)}` : "No run"}
          className={cn(
            "rounded-[2px]",
            size === "sm" ? "size-2.5" : "size-3",
            d ? SQUARE[d.s] : "bg-empty-cell",
          )}
        />
      ))}
    </div>
  );
}

export function RiskBar({ p, threshold, max = 0.4 }: { p: number; threshold: number; max?: number }) {
  const w = Math.min(100, (p / max) * 100);
  const t = Math.min(100, (threshold / max) * 100);
  return (
    <div className="relative h-1 w-full rounded-full bg-neutral-soft">
      <div
        className={cn("h-full rounded-full transition-[width] duration-500", p >= threshold ? "bg-alert" : "bg-foreground")}
        style={{ width: `${w}%` }}
      />
      <div className="absolute -top-0.5 h-2 w-px bg-alert-ink" style={{ left: `${t}%` }} aria-hidden />
    </div>
  );
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <h2 className="label-caps">{children}</h2>
      {aside}
    </div>
  );
}
