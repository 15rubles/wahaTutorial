# Muster

Private Warhammer 40,000 (11th Edition) army list builder. See [DESIGN.md](DESIGN.md) for the full design and milestones, and [CHANGELOG.md](CHANGELOG.md) for progress.

## Run everything with Docker

```bash
cp .env.example .env   # optional, defaults work for local use
docker compose up --build
```

Open http://localhost:8088. The header pill shows "Server online" once the backend and database are up. Change the port with `HTTP_PORT` in `.env`.

## Develop locally

Requirements: Java 21, Node 22, Docker (for Postgres and Testcontainers).

The compose database is not published on a host port. For local backend development, run a separate Postgres:

```bash
docker run -d --name muster-dev-db -p 5432:5432 -e POSTGRES_DB=muster -e POSTGRES_USER=muster -e POSTGRES_PASSWORD=muster postgres:16-alpine
```

Backend (port 8080):

```bash
cd backend && ./mvnw spring-boot:run
```

Frontend (port 5173, proxies `/api` to 8080):

```bash
cd frontend && npm install && npm run dev
```

## Tests

```bash
cd backend && ./mvnw verify      # unit + Testcontainers integration tests (needs Docker)
cd frontend && npm test          # Vitest + React Testing Library
cd frontend && npm run typecheck
```

End-to-end (Playwright) against a running stack; it imports the invented fixture data and registers a fresh user:

```bash
cd frontend && E2E_BASE_URL=http://localhost:5173 E2E_ADMIN_USER=admin E2E_ADMIN_PASSWORD=... npm run e2e
```

## Layout

```
backend/        Spring Boot app
frontend/       React app (Caddy image serves the build)
docker/         compose file (root compose.yaml includes it)
data-sources/   gitignored, raw import files - game data is never committed
```
