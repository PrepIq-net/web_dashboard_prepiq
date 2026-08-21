# PrepIQ Web Dashboard

The PrepIQ web dashboard is a Next.js 16 (App Router) application built with React 19, TypeScript, and Tailwind CSS v4. It serves as the primary interface for kitchen operators and managers to view production intelligence, manage inventory, track exceptions, and coordinate with the AI Analyst.

## Tech Stack

- **Framework**: Next.js 16 (App Router) with React 19
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v4 + CSS Variables for theming
- **State**: TanStack Query v5 (server state) + Zustand (client state)
- **Charts**: Recharts
- **Icons**: Iconoir React
- **Maps**: Leaflet + React-Leaflet
- **Forms**: React Hook Form + Zod validation
- **Linting**: ESLint (Next.js config)

## Prerequisites

- Node.js 20+
- npm / pnpm / yarn / bun
- Backend API running (see [backend/README.md](../backend/README.md))

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

```bash
cp env.example .env
```

Edit `.env` with your configuration:
- `NEXT_PUBLIC_API_URL` — Backend API base URL (e.g., `http://localhost:8000`)
- `NEXT_PUBLIC_WS_URL` — WebSocket URL for real-time features
- Any feature flags or third-party keys

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with Turbopack |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run check:notification-routes` | Verify notification route configuration |

## Project Structure

```
web_dashboard/
├── app/                    # Next.js App Router pages & layouts
│   ├── (auth)/            # Auth group (login, signup, password reset)
│   ├── (dashboard)/       # Protected dashboard routes
│   │   ├── hub/           # Main Hub — See / Understand / Act
│   │   ├── today/         # Today view — production plan
│   │   ├── inventory/     # Inventory management
│   │   ├── exceptions/    # Exception triage
│   │   ├── analyst/       # AI Analyst chat & charts
│   │   └── settings/      # Org & user settings
│   └── api/               # Route handlers (proxy, webhooks)
├── components/            # Shared UI components
│   ├── ui/                # Primitive components (Button, Card, Input, etc.)
│   ├── charts/            # Chart wrappers (Recharts)
│   ├── forms/             # Form components with Zod
│   └── ...
├── lib/                   # Utilities, hooks, API client
│   ├── api.ts             # TanStack Query + fetch wrapper
│   ├── auth.ts            # Auth helpers (cookies, tokens)
│   ├── theme.ts           # Theme tokens & CSS variable helpers
│   └── utils.ts           # General utilities
├── services/              # Domain-specific API services
├── constants/             # App-wide constants (roles, routes, etc.)
├── scripts/               # Build-time / CI scripts
└── public/                # Static assets
```

## Key Features

- **Hub (See / Understand / Act)**: Central command center with real-time exceptions, AI-driven insights, and one-tap actions
- **Today View**: Hourly production plan with demand forecasts and prep instructions
- **Inventory**: Real-time stock levels, par management, waste tracking
- **Analyst Chat**: Conversational AI with chart rendering, file exports, and bundle actions
- **Exceptions Triage**: Prioritized list with root-cause analysis and supplier PO generation
- **Dark Mode**: System-aware with manual toggle, persisted in localStorage
- **i18n Ready**: English / French with locale routing

## Design System

Design tokens live in:
- `lib/theme.ts` — Color palette, spacing, radii, shadows, motion tokens
- `globals.css` — CSS variable definitions (light/dark)
- `components/ui/` — Primitive components consuming tokens

See [DESIGN.md](./DESIGN.md) for full design system documentation.

## Deployment

### Vercel (Recommended)

1. Connect repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy — `vercel.json` handles rewrites for the App Router

### Docker

```dockerfile
# Multi-stage build example
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
```

**Note**: Set `output: 'standalone'` in `next.config.ts` for Docker deployments.

## Branching & PR Workflow

- `main` — Production-ready code
- Feature branches: `feature/<short-description>`
- Fix branches: `fix/<short-description>`
- PRs target `main` with squash merge
- CI runs lint, typecheck, and build on every PR

## Useful Links

- [Next.js Documentation](https://nextjs.org/docs)
- [TanStack Query Docs](https://tanstack.com/query/latest)
- [Tailwind CSS v4 Docs](https://tailwindcss.com/docs)
- [PrepIQ Backend API](../backend/README.md)