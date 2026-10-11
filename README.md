# The Host full-stack sample

A minimal full-stack app used to verify The Host deployments.

- `frontend/`: static page served at `/`. It calls `/api/hello` on the same origin.
- `backend/`: dependency-free Node.js HTTP API (`npm start`) with `/api/health` and `/api/hello`.
  `/api/hello` reports whether `SAMPLE_SECRET` is configured, never its value.

Contains no secrets.
