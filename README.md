# Vijayawada FloodAstra New Version Workspace

This folder is the clean target workspace for building the scalable, deployable Vijayawada Flood Command Center without removing any current release functionality.

Current source release remains under:

`../vijayawada_full_reproducible_20260623/expanded`

The new version should initially reuse existing model/data assets by reference or controlled copy. Do not delete, move, or mutate the old release until all parity checks and production acceptance tests pass.

## Folder Layout

```text
New_version/
  frontend/          React/TypeScript command-center frontend.
  backend/           FastAPI backend, APIs, DB models, services, workers.
  model_worker/      FloodAstra model-worker adapter and job execution layer.
  data/              Static GIS references, sample inputs, generated artifacts.
  deployment/        Docker, Nginx/Caddy, env, production deployment files.
  docs/              Phase-wise prompt, architecture, migration notes.
  scripts/           Data import, seeding, migration, and utility scripts.
  tests/             Frontend, backend, and model-worker tests.
```

## Main Prompt

Use this file as the development instruction:

`docs/PHASE_WISE_FULL_DEVELOPMENT_PROMPT.md`

## Cleanup Rule

Old data should only be removed or archived after:

1. New frontend covers all old dashboard features.
2. New backend exposes all old API capabilities.
3. Model worker reproduces existing quick/full run outputs.
4. GIS layers and artifacts are reachable from the new app.
5. Client-required MIS/AWARE workflows are implemented.
6. Backups are created.
7. The team signs off on migration parity.

