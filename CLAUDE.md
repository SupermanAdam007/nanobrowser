# Nanobrowser

AI web automation Chrome extension — Manifest V3, multi-agent (Navigator + Planner), Vercel AI SDK v6.

## Commands

- `pnpm install` — install deps (always `pnpm`, never npm/yarn)
- `pnpm dev` — dev mode with hot reload
- `pnpm build` — production build
- `pnpm -F chrome-extension type-check` — TypeScript check
- `pnpm -F chrome-extension lint` — ESLint
- `pnpm -F chrome-extension test` — Vitest unit tests
- Load extension: `chrome://extensions` → Developer Mode → Load unpacked → `dist/`
- `pnpm update-version <version>` — bump version in all package.json files (requires Unix shell)

## Architecture

- `chrome-extension/src/background/` — service worker (MV3), multi-agent orchestration
- `chrome-extension/src/background/agent/` — Navigator + Planner agents, `providers.ts` (Vercel AI SDK factory)
- `chrome-extension/src/background/browser/` — DOM access, Puppeteer automation
- `pages/side-panel/` — React chat UI
- `packages/` — storage, ui, schema-utils, i18n, shared, vite-config, tailwind-config

## Hard Rules

- NEVER commit or log API keys, tokens, or secrets
- NEVER edit generated files: `dist/**`, `build/**`, `packages/i18n/lib/**`
- NEVER touch `turbo.json`, `pnpm-workspace.yaml`, or root `tsconfig*` without approval
- NEVER add dependencies without asking first
- Always run `pnpm -F chrome-extension type-check` before declaring a task done

## Quality Gates (all must pass before done)

1. `pnpm -F chrome-extension type-check` — zero TypeScript errors
2. `pnpm -F chrome-extension lint` — zero violations in changed files
3. `pnpm -F chrome-extension test` — unit tests pass

## References

- Code style & naming: `.cursor/rules/code-style.mdc`
- Security guidelines: `.cursor/rules/security.mdc`
- Testing standards: `.cursor/rules/testing.mdc`
- i18n conventions: `.cursor/rules/i18n.mdc`
- Agent/LLM patterns: `.cursor/rules/agent-patterns.mdc`
