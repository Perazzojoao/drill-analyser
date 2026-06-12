# Drill Analyser

Drill Analyser is a local, no-database drilling data dashboard built with Next.js. It starts with a bundled sample dataset and lets users upload CSV drilling data, inspect normalized rows, visualize key parameters, review dataset warnings, and monitor user-configured min/max range alerts.

The project is intentionally scoped as a lightweight MVP: uploaded data is parsed and held in the browser/session, alert findings come from configured range checks, and same-origin API routes are stateless.

## Table of contents

- [Project overview and scope](#project-overview-and-scope)
- [Implemented features](#implemented-features)
- [Architecture and technical decisions](#architecture-and-technical-decisions)
- [Installation and setup](#installation-and-setup)
- [Development scripts](#development-scripts)
- [External libraries used](#external-libraries-used)
- [Data model and CSV expectations](#data-model-and-csv-expectations)
- [Project structure](#project-structure)
- [Testing and quality checks](#testing-and-quality-checks)
- [Limitations and non-goals](#limitations-and-non-goals)

## Project overview and scope

The application helps users quickly explore drilling datasets without setting up infrastructure or connecting external services.

Core scope:

- Load a sample drilling dataset on first visit.
- Upload a local CSV file and normalize supported drilling columns.
- Preview accepted rows and data-quality warnings.
- Display metric cards and parameter charts for recognized fields.
- Let users configure alert metrics with min/max ranges.
- Show alerts when recognized parameter values fall outside configured ranges.
- Keep large datasets out of persistent storage.

This dashboard is for exploratory visualization and explainable MVP checks only. It is not a safety-critical engineering interpretation system.

## Implemented features

- **Sample dashboard**: loads the bundled sample dataset through `GET /api/drilling/sample`.
- **CSV upload and local parsing**: parses CSV files in the browser with PapaParse.
- **Column normalization**: recognizes aliases for the target drilling schema, including BOM-safe `Depth` handling.
- **Data preview**: shows uploaded/normalized data with warnings for malformed, missing, invalid, sparse, or unrecognized values.
- **Metric cards**: summarizes drilling indicators from the active dataset.
- **Parameter charts**: visualizes drilling and petrophysical series with downsampling for responsiveness.
- **Configured range checks**: generates findings when selected metric values fall outside user-defined min/max ranges.
- **Dataset warnings**: surfaces data-quality issues in previews and dataset context rather than treating them as automatic alerts.
- **Dismissible alerts**: alert dismissal is session-oriented and local to the active dataset.
- **Alert metric configuration**: users can adjust tracked metrics and their min/max thresholds.
- **Application shell**: sidebar sections for Dashboard, Upload/Data Preview, Alert Metrics, and Alerts.
- **Header controls**: logo and light/dark/system theme toggle.
- **Stateless APIs**:
  - `GET /api/drilling/sample`
  - `POST /api/drilling/analyze`
- **Focused tests**: Vitest coverage for normalization, metrics, configured range rules, upload schema, and utilities.

## Architecture and technical decisions

- **Framework**: Next.js 16 App Router with React 19 and TypeScript.
- **Rendering model**: single Next.js web app with client-side dashboard interactions and same-origin route handlers.
- **State management**: Zustand stores browser-local UI preferences and compact metadata only.
- **Server persistence**: none. API routes do not persist uploaded files, request bodies, or analysis results.
- **Data fetching**: TanStack React Query handles client HTTP requests and caching.
- **Forms and validation**: react-hook-form with Zod schemas for upload/configuration validation.
- **CSV parsing**: PapaParse handles browser-side CSV ingestion.
- **Visualization**: Recharts renders chart components; series are downsampled before display.
- **Design system**: Tailwind CSS v4 with shadcn/Radix UI primitives and CSS variables from `src/app/globals.css`.
- **Theming**: `next-themes` provides light/dark/system theme behavior.
- **Notifications**: Sonner provides toast notifications.
- **Icons and utilities**: lucide-react, clsx, tailwind-merge, and class-variance-authority support reusable UI components.

## Installation and setup

Requirements:

- Node.js compatible with Next.js 16
- pnpm

Install dependencies:

```bash
pnpm install
```

Start the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

Build and run the production app locally:

```bash
pnpm build
pnpm start
```

## Development scripts

| Command | Description |
|---|---|
| `pnpm install` | Install project dependencies. |
| `pnpm dev` | Start the Next.js development server. |
| `pnpm build` | Create a production build. |
| `pnpm start` | Start the built production app. |
| `pnpm lint` | Run ESLint. |
| `pnpm typecheck` | Run TypeScript without emitting files. |
| `pnpm test` | Run the Vitest test suite once. |
| `pnpm test:watch` | Run Vitest in watch mode. |

## External libraries used

Dependencies are grouped by role:

- **Framework/runtime**: `next`, `react`, and `react-dom` power the App Router application and React UI runtime.
- **UI, styling, and build tooling**: Tailwind CSS v4, `@tailwindcss/postcss`, `tw-animate-css`, shadcn-style primitives, Radix UI packages, `class-variance-authority`, `clsx`, and `tailwind-merge` support styling, component composition, and CSS generation.
- **State and data fetching**: `zustand` manages lightweight client state; `@tanstack/react-query` handles API requests and cache state.
- **Parsing and validation**: `papaparse` parses CSV files; `react-hook-form`, `@hookform/resolvers`, and `zod` handle forms and schemas.
- **Charts**: `recharts` renders dashboard visualizations.
- **Icons and notifications**: `lucide-react` provides icons; `sonner` provides toast notifications; `next-themes` handles theme switching.
- **Test and quality tooling**: TypeScript, ESLint, Vitest, Testing Library, jsdom, and V8 coverage support linting, type checks, and automated tests.

## Data model and CSV expectations

The active dataset is represented as a local `DrillingDataset` with:

- source metadata (`mock` or `uploaded`), source name, load time, row count, and optional file size;
- one recognized axis, usually depth;
- recognized numeric drilling parameters;
- normalized in-memory measurements;
- quality warnings produced during parsing/normalization.

Target CSV fields:

| Field | Meaning | Notes |
|---|---|---|
| `Depth` | Primary depth axis | BOM-prefixed first header is handled safely. |
| `WOB` | Weight on bit | Numeric parameter. |
| `SURF_RPM` | Surface rotary speed / RPM | Numeric parameter. |
| `ROP AVG` or `ROP_AVG` | Rate of penetration | Both aliases are recognized. |
| `PHIF` | Formation porosity fraction | Validated as fraction-like data unless percent hints are present. |
| `VSH` | Volume of shale fraction | Validated as fraction-like data unless percent hints are present. |
| `SW` | Water saturation fraction | Validated as fraction-like data unless percent hints are present. |

CSV expectations:

- Files should be CSV-like and non-empty.
- MVP target size is up to 25 MB or 250,000 rows.
- Missing optional parameters should not block charts or metrics for available fields.
- Invalid, missing, sparse, malformed, or unrecognized values produce dataset warnings/previews instead of silent failures where possible.
- Uploaded datasets and chart-ready rows remain in memory for the current browser/session and are not stored in a database.

## Project structure

```text
src/
├── app/
│   ├── api/drilling/analyze/route.ts
│   ├── api/drilling/sample/route.ts
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── alerts/
│   ├── app-shell/
│   ├── dashboard/
│   ├── ui/
│   └── upload/
├── hooks/
│   ├── use-drilling-analysis.ts
│   └── use-sample-dataset.ts
└── lib/
    ├── api/
    ├── drilling/
    ├── forms/
    ├── query/
    ├── stores/
    └── utils.ts

tests/
└── lib/
    ├── drilling/
    ├── forms/
    └── utils.test.ts

specs/001-drill-data-dashboard/
├── plan.md
├── data-model.md
├── quickstart.md
└── contracts/api-contracts.md
```

## Testing and quality checks

Run these checks before committing changes:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Focused automated tests currently cover core business logic such as:

- CSV column normalization and aliases;
- metric calculation;
- configured range-check detection;
- upload schema validation;
- shared utilities.

For UI or behavior changes, also perform manual QA from `specs/001-drill-data-dashboard/quickstart.md`, including sample load, theme cycling, CSV upload, data preview warnings, alert dismissal, and API behavior.

## Limitations and non-goals

- No database.
- No server-side upload persistence.
- No authentication, authorization, or multi-tenancy.
- No background jobs or queued processing.
- No required external services.
- No long-term storage for uploaded datasets or analysis results.
- Only lightweight preference/metadata persistence is allowed in browser local storage.
- Configured range findings are explainable threshold checks, not a replacement for engineering validation or safety-critical drilling analysis.
