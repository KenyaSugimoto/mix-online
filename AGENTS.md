# Repository Guidelines

## Project Structure & Module Organization

This is a pnpm workspace monorepo. Workspace packages live under `apps/` and `packages/` as defined in `pnpm-workspace.yaml`. Shared TypeScript configuration is centralized in `tsconfig.base.json`. Documentation is kept in `docs/`, with MVP materials under `docs/mvp/` (requirements and design documents, plus API specs such as `openapi.yaml` and `asyncapi.yaml`). Generated outputs should be placed in per-package `dist/` directories and are ignored by tooling.

## Build, Test, and Development Commands

All commands are run from the repo root with pnpm:

- `pnpm dev`: run all workspace apps in parallel (delegates to each package’s `dev` script).
- `pnpm build`: build every workspace package.
- `pnpm typecheck`: run TypeScript type checks across the workspace.
- `pnpm lint`: run Biome lint/format checks for the whole repo.
- `pnpm lint:fix`: apply Biome fixes and formatting.

## Coding Style & Naming Conventions

Formatting and linting are enforced by Biome (`biome.json`). Use 2-space indentation, double quotes, and semicolons in JavaScript/TypeScript. Prefer conventional naming: `camelCase` for variables and functions, `PascalCase` for classes/components, and `kebab-case` for file and folder names unless a package’s existing style differs.

## Testing Guidelines

There is no test framework configured yet and no top-level `tests/` directory. If you add tests, create a clear structure (for example `tests/` or `__tests__/` within each package), document the chosen framework, and add a single workspace command (e.g., `pnpm test`) that runs all tests. Use consistent test file names such as `*.test.ts` or `*.spec.ts`.

## Commit & Pull Request Guidelines

Git history indicates short, descriptive commit messages (sometimes in Japanese and with emoji). Keep commit summaries concise and aligned with existing style. For pull requests, include a clear description of changes and purpose, link relevant documents in `docs/`, and provide screenshots or samples when user-facing behavior changes.

## Documentation Updates

Documentation is a primary artifact for this repo today. Keep sections short, structured, and cross-link related documents when updating files under `docs/mvp/`.
