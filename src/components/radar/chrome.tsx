import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { useNow } from "@/hooks/use-now";
import { useAsOf } from "@/lib/dpfp/as-of";
import { fmtCountdown, fmtDay, fmtShort, isDataLate, nextUpdate } from "@/lib/dpfp/dates";
import { dataQuery, REPO } from "@/lib/dpfp/queries";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/", label: "Overview", exact: true },
  { to: "/track-record", label: "Track record" },
  { to: "/calendar", label: "Calendar" },
  { to: "/model", label: "Model" },
  { to: "/add-pipeline", label: "Add pipeline" },
] as const;

export function Logo() {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="Pipeline Radar home">
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
        <circle cx="11" cy="11" r="10" fill="none" stroke="var(--foreground)" strokeWidth="1.5" />
        <circle cx="11" cy="11" r="5.5" fill="none" stroke="var(--foreground)" strokeWidth="1" opacity=".45" />
        <path d="M11 11 L11 1 A10 10 0 0 1 19.7 6 Z" fill="var(--foreground)" opacity=".18" />
        <line x1="11" y1="11" x2="19.7" y2="6" stroke="var(--foreground)" strokeWidth="1.5" />
        <circle cx="15" cy="13.5" r="1.6" fill="var(--alert)" />
      </svg>
      <span className="text-sm font-semibold tracking-tight">Pipeline Radar</span>
    </Link>
  );
}

function Freshness() {
  const { data } = useQuery(dataQuery);
  const now = useNow(30_000);
  if (!data) return <span className="font-mono text-xs text-muted-foreground">loading…</span>;
  const late = now ? isDataLate(data.built_at, now) : false;
  return (
    <span className="font-mono text-xs whitespace-nowrap">
      {late ? (
        <span className="font-semibold text-fail-ink">Data is late · through {fmtShort(data.data_through)}</span>
      ) : (
        <span className="text-muted-foreground">
          data through <span className="text-foreground">{fmtShort(data.data_through)}</span>
          {now && (
            <span className="hidden sm:inline">
              {" · "}next update in{" "}
              <span className="text-foreground">{fmtCountdown(nextUpdate(now).getTime() - now.getTime())}</span>
            </span>
          )}
        </span>
      )}
    </span>
  );
}

export function TopBar() {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 pt-3 pb-2 md:py-3">
        <Logo />
        <nav className="hidden md:flex md:items-center md:gap-1" aria-label="Main">
          <NavLinks />
        </nav>
        <Freshness />
      </div>
      <nav className="-mb-px flex gap-1 overflow-x-auto px-3 pb-2 md:hidden" aria-label="Main mobile">
        <NavLinks />
      </nav>
      <TimeTravelBar />
    </header>
  );
}

function NavLinks() {
  return (
    <>
      {NAV.map((n) => (
        <Link
          key={n.to}
          to={n.to}
          activeOptions={{ exact: "exact" in n ? n.exact : false }}
          className="shrink-0 rounded-sm px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          activeProps={{ className: "bg-secondary !text-foreground font-medium" }}
        >
          {n.label}
        </Link>
      ))}
    </>
  );
}

export function TimeTravelBar() {
  const { pinned, isLatest, pin } = useAsOf();
  if (isLatest || !pinned) return null;
  return (
    <div className="bg-travel text-travel-foreground fade-up">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-1.5 text-xs">
        <span className="flex items-center gap-2">
          <History className="size-3.5" aria-hidden />
          <span>
            Viewing <span className="font-mono font-semibold">{fmtDay(pinned)}</span> (time travel)
          </span>
          <span className="hidden text-travel-foreground/60 sm:inline">← → step a day · T for today</span>
        </span>
        <Button size="xs" variant="travel" onClick={() => pin(null)}>
          Back to today
        </Button>
      </div>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="mt-16 border-t">
      <div className="mx-auto max-w-7xl px-4 py-6 text-xs text-muted-foreground">
        Forecasts by the DPFP model (Random Forest). Repo:{" "}
        <a
          href={`https://${REPO}`}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-foreground underline-offset-2 hover:underline"
        >
          {REPO}
        </a>
      </div>
    </footer>
  );
}
