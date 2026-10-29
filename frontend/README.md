# SamarthCare AI — Phase 1 Frontend

Modern, accessible, decision-support web application for Care Coordinators monitoring senior citizens living at home. Built with Next.js 14 (App Router), TypeScript, Tailwind CSS, and Vitest.

---

## Quickstart

```bash
# 1. Install dependencies
npm install

# 2. Run local development server
npm run dev

# 3. Open in browser
# http://localhost:3000
```

---

## Available Scripts

- `npm run dev`: Starts the Next.js local development server on port 3000.
- `npm run build`: Compiles optimized production bundle with type checking and static generation.
- `npm run start`: Runs the built production server.
- `npm run lint`: Runs ESLint with `next/core-web-vitals` rules.
- `npm run type-check`: Runs TypeScript compiler (`tsc --noEmit`) across all files.
- `npm run test`: Runs the Vitest automated test suite.

---

## Key Pages

- `/dashboard`: High-level population metrics, risk distribution chart, and priority triage queue.
- `/seniors`: Filterable, searchable directory of enrolled seniors with sorting by risk score, age, and observation dates.
- `/seniors/[seniorId]`: Detailed senior profile with longitudinal risk trajectory, vital measurements, daily activity logs, medications, and check-in transcripts.
- `/alerts`: Triage center for automated early-warning alerts, supporting coordinator acknowledgment and clinical resolution workflows.

---

## Switching to Live Backend

By default, the application runs in **Synthetic Mock Mode** using deterministic fixtures.
To connect to the local FastAPI backend, edit `.env.local`:

```bash
NEXT_PUBLIC_DATA_SOURCE=live
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

