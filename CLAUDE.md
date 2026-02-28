# Travel Helper

## Project Level: Dynamic

A fullstack travel helper app for discovering and saving places & recommendations.

## Tech Stack

- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS
- **State**: Zustand (auth/global), TanStack Query (server state)
- **Backend**: bkend.ai (authentication, database, REST API)
- **Deployment**: Vercel (frontend) + bkend.ai (backend)

## Key Directories

- `src/app/` — Next.js App Router pages
- `src/components/` — Reusable UI components
- `src/hooks/` — Custom React hooks
- `src/lib/bkend.ts` — bkend.ai API client
- `src/stores/` — Zustand stores
- `src/types/` — TypeScript types
- `docs/` — PDCA documentation

## Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your bkend.ai credentials:

```
NEXT_PUBLIC_BKEND_API_URL=https://api.bkend.ai/v1
NEXT_PUBLIC_BKEND_PROJECT_ID=your-project-id
NEXT_PUBLIC_BKEND_ENV=dev
```

## Development

```bash
npm run dev     # Start dev server (http://localhost:3000)
npm run build   # Production build
npm run lint    # Run ESLint
```

## PDCA Status

See `docs/.pdca-status.json` for current development phase.
Current phase: Phase 1 — Schema & Terminology
