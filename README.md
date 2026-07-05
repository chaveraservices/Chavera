# Chavera — Contact Directory

Full-stack contact management app (React + Express + MongoDB) for managing
contacts organized by State → District → City/Village.

## Structure

- `backend/` — Express 5 REST API with MongoDB (Mongoose), JWT auth.
- `frontend/` — React 19 SPA (Vite), React Router.

## Getting started

### Backend
```bash
cd backend
cp .env.example .env   # then fill in the values
npm install
npm run seed           # creates the admin user
npm run dev            # starts on http://localhost:3001
```

### Frontend
```bash
cd frontend
npm install
npm run dev            # starts on http://localhost:5173
```

## Branches

- `main` — stable / production baseline.
- `UAT`  — User Acceptance Testing. Changes are validated here before promotion to `main`.

## Environment variables (backend)

See `backend/.env.example`. Required: `MONGO_URI`, `JWT_SECRET`. Optional:
`PORT`, `CORS_ORIGIN`.
