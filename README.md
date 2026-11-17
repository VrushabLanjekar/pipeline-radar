# Pipeline Radar

Web dashboard for the DPFP project (Data-Pipeline Failure Prediction): it shows which data pipelines are likely to fail on their next daily run, why, and how past forecasts turned out.

- Pipeline, model and data: https://github.com/VrushabLanjekar/DPFP-Project
- Data the app reads (rebuilt every day at 08:00 IST by GitHub Actions): https://vrushablanjekar.github.io/DPFP-Project/data.json

The app has no backend or database. It loads the public `data.json`, `outputs/forecast_log.csv` and the run logs from the DPFP repo in the browser.

## Pages

- **Overview**: all pipelines ranked by next-run risk, with a one-line status.
- **Pipeline**: risk chart with time travel, alert-line slider, reasons, signals and alert log.
- **Track record**: forecasts saved the morning they were made, against what happened.
- **Calendar**: every daily run since Aug 2022.
- **Model**: forecast quality, weekly retrain history, how it works.
- **Add pipeline**: checks a run-log CSV against the required columns.

## Run locally (VS Code)

Needs Node.js 20 or newer and an internet connection (the data is fetched live).

```bash
npm install
npm run dev
```

Then open the `http://localhost:...` link printed in the terminal.

## Deploy

Hosted on Vercel. The project setting `NITRO_PRESET=vercel` makes the build target Vercel.

Stack: React, TypeScript, TanStack Start, Tailwind CSS, shadcn/ui, Recharts.
