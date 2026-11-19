import { queryOptions } from "@tanstack/react-query";
import { parseForecastLog, parseHistory } from "./csv";
import type { DpfpData, Pipeline } from "./types";

export const REPO = "github.com/VrushabLanjekar/DPFP-Project";
export const LOG_URL =
  "https://raw.githubusercontent.com/VrushabLanjekar/DPFP-Project/main/outputs/forecast_log.csv";
const RAW_BASE = "https://raw.githubusercontent.com/VrushabLanjekar/DPFP-Project/main";
// Read from the repo itself: it is always current and does not depend on GitHub Pages being up.
export const DATA_URL = `${RAW_BASE}/dashboard/data.json`;

export function historyUrl(p: Pipeline): string {
  return `${RAW_BASE}/${p.table.replace(/^\/+|\/+$/g, "")}/pipeline_runs.csv`;
}

async function fetchText(url: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-cache" });
  } catch {
    throw new Error(`Could not reach ${new URL(url).host}. Check your connection.`);
  }
  if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status} ${res.statusText}`.trim());
  return res.text();
}

function assertData(d: unknown): DpfpData {
  const x = d as DpfpData;
  if (!x || typeof x.threshold !== "number" || !Array.isArray(x.pipelines) || !x.data_through) {
    throw new Error("data.json is not in the expected format");
  }
  return x;
}

export const dataQuery = queryOptions({
  queryKey: ["dpfp", "data"],
  queryFn: async () => {
    const text = await fetchText(DATA_URL);
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error("data.json could not be read (invalid JSON)");
    }
    return assertData(json);
  },
  staleTime: 5 * 60_000,
  retry: 1,
});

export const forecastLogQuery = queryOptions({
  queryKey: ["dpfp", "forecast-log"],
  queryFn: async () => parseForecastLog(await fetchText(LOG_URL)),
  staleTime: 5 * 60_000,
  retry: 1,
});

export const historyQuery = (p: Pipeline) =>
  queryOptions({
    queryKey: ["dpfp", "history", p.id],
    queryFn: async () => parseHistory(await fetchText(historyUrl(p))),
    staleTime: 30 * 60_000,
    retry: 1,
  });
