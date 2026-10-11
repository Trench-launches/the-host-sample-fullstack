# The Host full-stack sample

A minimal full-stack app used to verify The Host deployments.

- `frontend/`: static page served at `/`. It calls `/api/hello` on the same origin.
- `backend/`: dependency-free Node.js HTTP API (`npm start`) with `/api/health`, `/api/version` and `/api/hello`. `backend/version.json` tells deployments apart.
  `/api/hello` reports whether `SAMPLE_SECRET` is configured, never its value.

Contains no secrets.

<!-- webhook check 2026-10-11: README-only change used to verify The Host receives signed GitHub push events -->
