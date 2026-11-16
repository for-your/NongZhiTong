# 农智通 React Vite 项目 — Agent Contract

## Goal

Use this project contract to keep the 农智通比赛项目 easy to run, inspect, and extend.

## Command Contract

Use `pnpm` only.

```bash
pnpm dev         # Start dev server
pnpm build       # Build production assets
pnpm type-check  # TypeScript check (tsc --noEmit)
pnpm lint        # ESLint
pnpm check       # Required gate: type-check + lint
```

## Task Entry (always follow)

1. Confirm target template and feature goal in one sentence.
2. Locate the matching module area (`pages`, `components`, `lib`, `router`).
3. Reuse existing patterns from `src/components/ui` and `src/lib`.
4. Implement with framework-native style (React function components + hooks).
5. Run `pnpm check` before finalizing.

## Isomorphic Structure Mapping

Use these module locations in this React template:

| Concern             | React location               |
| ------------------- | ---------------------------- |
| Route pages         | `src/pages/*.tsx`            |
| Shared components   | `src/components/**`          |
| Nuwax agent client  | `src/lib/nuwax.ts`           |
| Chat state           | `src/store/chatStore.ts`      |
| Utilities           | `src/lib/*.ts`               |
| Router registry     | `src/router/index.tsx`       |

## Minimal Delivery Paths

### New page (5 steps)

1. Create `src/pages/<FeatureName>.tsx`.
2. Add route in `src/router/index.tsx` with path + element.
3. Use existing UI primitives from `src/components/ui`.
4. If data is required, call helpers under `src/lib/*` (e.g. `news.ts`, `nuwax.ts`).
5. Run `pnpm check`.

### New component (4 steps)

1. Create component under `src/components/` (or `src/components/ui/` for primitives).
2. Type all props and callbacks explicitly.
3. Keep styling Tailwind-first and reuse existing component styles.
4. Run `pnpm check`.

### New API flow (4 steps)

1. Define/extend endpoint calls in `src/lib/nuwax.ts` (or a sibling lib module).
2. Keep response types co-located with the call.
3. Consume via page/component state hooks.
4. Run `pnpm check`.

## Allowed Changes

- `src/pages/**`, `src/components/**`, `src/lib/**`, `src/store/**`, `src/router/**`
- Template docs (`AGENTS.md`, `README.md`)
- Template-local config required for feature delivery

## Forbidden Changes

- Do not change package manager (`pnpm` is mandatory).
- Do not add parallel agent rule docs (this file is the single source).
- Do not introduce framework-mixed patterns (keep React idioms only).

## Pre-submit Checklist

1. `pnpm check` passes in this template.
2. If template metadata/version changed, validate related metadata files before release.
3. New route/page/API follows the mapping table and naming conventions.
