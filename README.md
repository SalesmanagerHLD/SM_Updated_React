# SalesManager CRM — Web Frontend

React single-page app for SalesManager CRM. Repository: [SalesmanagerHLD/SM_Updated_React](https://github.com/SalesmanagerHLD/SM_Updated_React). Talks to the Spring Boot API in [SM_Updated_java](https://github.com/SalesmanagerHLD/SM_Updated_java); the Flutter field-rep app lives in [SM_Updated_Mobile](https://github.com/SalesmanagerHLD/SM_Updated_Mobile).

## Stack

- React 18 + TypeScript + Vite
- MUI (Material UI) v9
- TanStack React Query (server state), React Hook Form + Zod (forms), react-router-dom v6, Recharts (charts)
- Oxlint for linting

## Getting started

```bash
npm install
cp .env.example .env   # then adjust values
npm run dev            # http://localhost:5173, API at VITE_API_BASE_URL
```

| Script | Purpose |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Type-check (`tsc -b`) and production build to `dist/` |
| `npm run lint` | Oxlint |
| `npm run preview` | Serve the production build locally |

## Configuration

- `.env` — local development. `VITE_API_BASE_URL` defaults to `http://localhost:8080/api/v1`.
- `.env.production` — used by `vite build`. `VITE_API_BASE_URL=/api/v1` is a relative path, so the built app calls the API on whatever host serves it (nginx reverse-proxies `/api/` to the backend). No rebuild is needed if the public IP or domain changes.
- Firebase web config (`VITE_FIREBASE_*`) is optional and only needed for push notifications.

## Deployment

The `dist/` output is served as static files by nginx on the AWS EC2 instance. See Section 18 of [CRM_IMPLEMENTATION.md](https://github.com/SalesmanagerHLD/SM_Updated_java/blob/main/docs/CRM_IMPLEMENTATION.md) for the full deployment architecture.

## Branching

`main` reflects what is deployed. Ongoing work goes on `develop` or a feature branch, then merges to `main`.

## Documentation

Project-wide documentation lives in the backend repo's docs folder:

- [CRM_IMPLEMENTATION.md](https://github.com/SalesmanagerHLD/SM_Updated_java/blob/main/docs/CRM_IMPLEMENTATION.md) — what is built, architecture, deployment
- [EMPLOYEE_ENTITLEMENT_PLAN.md](https://github.com/SalesmanagerHLD/SM_Updated_java/blob/main/docs/EMPLOYEE_ENTITLEMENT_PLAN.md) — Leave and entitlement design
- [SalesManager_CRM_Modules_and_Workflows.md](https://github.com/SalesmanagerHLD/SM_Updated_java/blob/main/docs/SalesManager_CRM_Modules_and_Workflows.md) — modules and workflows

## Related repositories

- [SM_Updated_java](https://github.com/SalesmanagerHLD/SM_Updated_java) — backend API
- [SM_Updated_Mobile](https://github.com/SalesmanagerHLD/SM_Updated_Mobile) — Flutter mobile app
