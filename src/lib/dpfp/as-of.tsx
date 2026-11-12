import { useQuery } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { allDates } from "./logic";
import { dataQuery } from "./queries";

interface AsOfValue {
  /** Effective date (hover preview wins over the pinned date). */
  date: string;
  pinned: string | null;
  latest: string;
  first: string;
  dates: string[];
  isLatest: boolean;
  pin: (d: string | null) => void;
  hover: (d: string | null) => void;
  step: (n: number) => void;
}

const Ctx = createContext<AsOfValue | null>(null);

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    t.isContentEditable ||
    t.getAttribute("role") === "slider"
  );
}

export function AsOfProvider({ children }: { children: ReactNode }) {
  const { data } = useQuery(dataQuery);
  const [pinned, setPinned] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const dates = useMemo(() => (data ? allDates(data.pipelines) : []), [data]);
  const latest = data?.data_through ?? dates[dates.length - 1] ?? "";
  const first = dates[0] ?? latest;

  const pin = useCallback(
    (d: string | null) => {
      setPinned(d === null || d === latest ? null : d);
    },
    [latest],
  );

  const step = useCallback(
    (n: number) => {
      if (!dates.length) return;
      setPinned((cur) => {
        const base = cur ?? latest;
        let i = dates.indexOf(base);
        if (i < 0) i = dates.length - 1;
        const next = dates[Math.min(dates.length - 1, Math.max(0, i + n))] ?? latest;
        return next === latest ? null : next;
      });
    },
    [dates, latest],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        step(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        step(1);
      } else if (e.key === "t" || e.key === "T") {
        setPinned(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  const value = useMemo<AsOfValue>(() => {
    const date = hovered ?? pinned ?? latest;
    return {
      date,
      pinned,
      latest,
      first,
      dates,
      isLatest: (pinned ?? latest) === latest,
      pin,
      hover: setHovered,
      step,
    };
  }, [hovered, pinned, latest, first, dates, pin, step]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAsOf(): AsOfValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAsOf must be used inside AsOfProvider");
  return v;
}
