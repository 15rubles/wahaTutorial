# Changelog

## M1 - Auth

- Invite-only registration (username, email, password, single-use invite code with expiry), login, logout, `GET /api/me`.
- Session cookie `MUSTER_SESSION` (HttpOnly, Secure, SameSite=Lax) stored with Spring Session JDBC, so sessions survive restarts. Session id changes on login.
- CSRF on for every state-changing request (`XSRF-TOKEN` cookie echoed as `X-XSRF-TOKEN`).
- Account lockout: 15 minutes after 10 failed logins in a row. Unknown users get the same error as wrong passwords.
- First admin created from `ADMIN_USERNAME` / `ADMIN_PASSWORD` on startup. Admin page to create invites (1 to 90 days) and copy the register link.
- Frontend: sign in and register pages, auth guards, "My lists" page (empty until M4), header with account menu.

## M0 - Scaffold

- Monorepo: `backend/` (Spring Boot 3.5, Java 21, Flyway, Postgres), `frontend/` (React 18, TypeScript strict, Vite), `docker/`, gitignored `data-sources/`.
- `GET /api/health` reports app and database status (503 when the database is unreachable). Shared error shape `{code, message, fieldErrors[]}` for every API error.
- Frontend shell in the "A1 dark" palette: `tokens.css`, self-hosted Atkinson Hyperlegible and IBM Plex Mono, routing, header with a live server status pill, empty Add units / List / Details panes.
- Docker Compose: `db`, `backend`, `frontend` (Caddy serves the static build and proxies `/api`). `docker compose up` from the repo root.
- Tests: JUnit 5 + Testcontainers (Postgres) for the backend, Vitest + React Testing Library for the frontend.
