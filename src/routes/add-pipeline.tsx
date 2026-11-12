import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Check, Copy, FileUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtLong } from "@/lib/dpfp/dates";
import { csvToObjects } from "@/lib/dpfp/csv";
import { dataQuery, REPO } from "@/lib/dpfp/queries";
import type { DpfpData } from "@/lib/dpfp/types";
import { QueryGate } from "@/components/radar/states";
import { SectionTitle } from "@/components/radar/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/add-pipeline")({
  head: () => ({
    meta: [
      { title: "Add a pipeline · Pipeline Radar" },
      { name: "description", content: "Check a pipeline run log in your browser and get the config to add it." },
      { property: "og:title", content: "Add a pipeline · Pipeline Radar" },
      { property: "og:description", content: "Validate a CSV run log against the required columns, in the browser." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AddPipelinePage,
});

function AddPipelinePage() {
  const q = useQuery(dataQuery);
  return <QueryGate query={q}>{(data) => <AddPipeline data={data} />}</QueryGate>;
}

interface Checked {
  fileName: string;
  header: string[];
  rows: number;
  first?: string | undefined;
  last?: string | undefined;
}

function slug(s: string) {
  return s.toLowerCase().replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function AddPipeline({ data }: { data: DpfpData }) {
  const [file, setFile] = useState<Checked | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ id: "", name: "", source: "", folder: "", owner: "", config: "" });
  const [copied, setCopied] = useState(false);

  async function onFile(f: File | undefined) {
    setError(null);
    setFile(null);
    if (!f) return;
    try {
      const text = await f.text();
      const { header, rows } = csvToObjects(text);
      if (!header.length || header.every((h) => !h)) throw new Error("The file has no header row.");
      const dates = rows.map((r) => r["run_date"]?.slice(0, 10)).filter((d) => d && /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
      setFile({ fileName: f.name, header, rows: rows.length, first: dates[0], last: dates[dates.length - 1] });
      const base = slug(f.name).replace(/_?pipeline_runs$/, "") || "new_pipeline";
      setForm((s) => ({
        id: s.id || base,
        name: s.name || base,
        source: s.source,
        folder: s.folder || `${base}_runs`,
        owner: s.owner,
        config: s.config || `${base}.yaml`,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read this file.");
    }
  }

  const checks = data.required_columns.map((c) => ({ c, ok: !!file?.header.includes(c) }));
  const allOk = !!file && checks.every((x) => x.ok);
  const snippet = JSON.stringify(
    {
      id: form.id,
      name: form.name,
      source: form.source,
      table: `logs/${form.folder}`,
      owner: form.owner,
      config: `config/${form.config}`,
    },
    null,
    2,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Add a pipeline</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Pipelines are added in the GitHub repo (
          <a href={`https://${REPO}`} target="_blank" rel="noreferrer" className="font-mono underline">
            {REPO}
          </a>
          ). Check your run log here first: the file is read in your browser only and never uploaded.
        </p>
      </div>

      <section className="panel p-4">
        <SectionTitle>1 · Check a CSV run log</SectionTitle>
        <label
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed px-4 py-8 text-center transition-colors hover:bg-muted/50",
          )}
        >
          <FileUp className="size-5 text-muted-foreground" aria-hidden />
          <span className="text-sm font-medium">{file ? file.fileName : "Choose a .csv file"}</span>
          <span className="text-xs text-muted-foreground">It must contain the {data.required_columns.length} columns below</span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </label>
        {error && <p className="mt-3 text-sm text-fail-ink">{error}</p>}
        {file && (
          <div className="mt-4 grid grid-cols-3 gap-3">
            <Stat label="Rows" value={String(file.rows)} />
            <Stat label="First run" value={file.first ? fmtLong(file.first) : "–"} />
            <Stat label="Last run" value={file.last ? fmtLong(file.last) : "–"} />
          </div>
        )}
        <div className="mt-4 flex items-baseline justify-between">
          <div className="label-caps">Required columns</div>
          {file && (
            <span className={cn("font-mono text-xs", allOk ? "text-ok-ink" : "text-fail-ink")}>
              {checks.filter((x) => x.ok).length} of {checks.length} found
            </span>
          )}
        </div>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-4">
          {checks.map(({ c, ok }) => (
            <li key={c} className="flex items-center gap-2 rounded-sm px-1 py-0.5 font-mono text-xs">
              {!file ? (
                <span className="size-3.5 rounded-full border" aria-hidden />
              ) : ok ? (
                <Check className="size-3.5 text-ok" aria-label="found" />
              ) : (
                <X className="size-3.5 text-fail" aria-label="missing" />
              )}
              <span className={cn(file && !ok && "text-fail-ink")}>{c}</span>
            </li>
          ))}
        </ul>
      </section>

      {allOk && (
        <section className="panel p-4 fade-up">
          <SectionTitle>2 · Config to paste into the repo</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(
              [
                ["id", "Id"],
                ["name", "Name"],
                ["source", "Source"],
                ["folder", "Log folder (logs/…)"],
                ["owner", "Owner"],
                ["config", "Config file (config/…)"],
              ] as const
            ).map(([k, l]) => (
              <div key={k} className="space-y-1">
                <Label htmlFor={k} className="text-xs text-muted-foreground">
                  {l}
                </Label>
                <Input
                  id={k}
                  value={form[k]}
                  onChange={(e) => setForm((s) => ({ ...s, [k]: e.target.value }))}
                  className="font-mono text-xs"
                />
              </div>
            ))}
          </div>
          <div className="relative mt-4">
            <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs leading-5">{snippet}</pre>
            <Button
              size="xs"
              variant="outline"
              className="absolute top-2 right-2"
              onClick={async () => {
                await navigator.clipboard.writeText(snippet);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="font-mono text-sm font-semibold">{value}</div>
    </div>
  );
}
