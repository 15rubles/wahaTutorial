# Changelog

## M0 - Scaffold

- Monorepo: `backend/` (Spring Boot 3.5, Java 21, Flyway, Postgres), `frontend/` (React 18, TypeScript strict, Vite), `docker/`, gitignored `data-sources/`.
- `GET /api/health` reports app and database status (503 when the database is unreachable). Shared error shape `{code, message, fieldErrors[]}` for every API error.
- Frontend shell in the "A1 dark" palette: `tokens.css`, self-hosted Atkinson Hyperlegible and IBM Plex Mono, routing, header with a live server status pill, empty Add units / List / Details panes.
- Docker Compose: `db`, `backend`, `frontend` (Caddy serves the static build and proxies `/api`). `docker compose up` from the repo root.
- Tests: JUnit 5 + Testcontainers (Postgres) for the backend, Vitest + React Testing Library for the frontend.
