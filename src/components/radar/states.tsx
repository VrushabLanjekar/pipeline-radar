import type { ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LoadingState({ label = "Loading the latest forecasts" }: { label?: string | undefined }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24" role="status" aria-live="polite">
      <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden>
        <circle cx="22" cy="22" r="20" fill="none" stroke="var(--border)" />
        <circle cx="22" cy="22" r="12" fill="none" stroke="var(--border)" />
        <g className="radar-sweep">
          <line x1="22" y1="22" x2="22" y2="2" stroke="var(--foreground)" strokeWidth="1.5" />
        </g>
        <circle cx="22" cy="22" r="2" fill="var(--foreground)" />
      </svg>
      <p className="font-mono text-xs text-muted-foreground">{label}…</p>
    </div>
  );
}

export function ErrorState({
  title = "Could not load the data",
  error,
  onRetry,
  retrying,
}: {
  title?: string | undefined;
  error: unknown;
  onRetry: () => void;
  retrying?: boolean | undefined;
}) {
  const msg = error instanceof Error ? error.message : String(error ?? "Unknown error");
  return (
    <div className="mx-auto my-16 max-w-md panel border-fail/40 p-6 text-center" role="alert">
      <AlertTriangle className="mx-auto size-6 text-fail" aria-hidden />
      <h2 className="mt-3 text-base font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Nothing is shown rather than guessing. The source said:
      </p>
      <p className="mt-2 break-words rounded-sm bg-muted px-2 py-1.5 font-mono text-xs">{msg}</p>
      <Button className="mt-4" onClick={onRetry} disabled={retrying}>
        <RotateCw className={retrying ? "animate-spin" : ""} aria-hidden />
        Retry
      </Button>
    </div>
  );
}

export function QueryGate<T>({
  query,
  title,
  loadingLabel,
  children,
}: {
  query: UseQueryResult<T>;
  title?: string | undefined;
  loadingLabel?: string | undefined;
  children: (data: T) => ReactNode;
}) {
  if (query.data !== undefined) return <>{children(query.data)}</>;
  if (query.isError)
    return (
      <ErrorState
        title={title}
        error={query.error}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
      />
    );
  return <LoadingState label={loadingLabel} />;
}
