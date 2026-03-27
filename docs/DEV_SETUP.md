# DEV Setup Guide

Local development setup for **Find My Expert**.

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | ≥ 22 | [nodejs.org](https://nodejs.org) |
| npm | ≥ 10 | bundled with Node.js |
| Git | any | [git-scm.com](https://git-scm.com) |
| `@sap/cds-dk` | ≥ 9 | `npm i -g @sap/cds-dk` |

Optional (for UI5 standalone build):

```bash
npm i -g @ui5/cli
```

---

## 1. Clone & Install

```bash
git clone https://github.com/LINZO-AT/find-my-expert.git
cd find-my-expert
npm install
```

---

## 2. Start the Dev Server

```bash
npm start
# or for hot-reload:
npm run watch
```

The CAP server starts on **port 4004** (configurable in `.cdsrc.json`).

---

## 3. Open the App

| URL | Description |
|---|---|
| `http://localhost:4004/findmyexpert/webapp/index.html` | Standalone SAPUI5 App |
| `http://localhost:4004/findmyexpert/webapp/sandbox.html` | Fiori Launchpad Sandbox |
| `http://localhost:4004/api/catalog/` | CAP OData Catalog Service |
| `http://localhost:4004/api/admin/` | CAP OData Admin Service |

---

## 4. Authentication in DEV

In DEV mode **no login is required**. The app automatically authenticates as Admin:

- `Component.js` pre-injects `Authorization: Basic anonymous:` into all OData models
  synchronously **before** the router initializes
- CAP mocked auth (`anonymous` user in `.cdsrc.json`) has `Admin + Viewer` roles
- `userInfo()` returns `{ isAdmin: true, userName: "Dev/Admin" }`
- All Admin views (Topics & Solutions, Expert Management) work without any popup

> ⚠️ The Basic Auth header `anonymous:` is **only injected in DEV**. In PROD (XSUAA),
> `userInfo()` detects the XSUAA token and clears the DEV header immediately.

---

## 5. Database

The project uses **SQLite** for local development. The database file is at `db.sqlite`.

### Seed Data

The `db/data/` folder contains CSV files with initial data:

| File | Records |
|---|---|
| `findmyexpert-Topics.csv` | 8 topics (AI, BTP, BDC, CloudERP, …) |
| `findmyexpert-Solutions.csv` | 44 solutions |
| `findmyexpert-Experts.csv` | 20 experts |
| `findmyexpert-ExpertRoles.csv` | 85 role assignments |

### Reset / Re-seed

```bash
# Delete and re-create the SQLite DB with seed data
rm db.sqlite
cds deploy --to sqlite:db.sqlite
```

---

## 6. Project Scripts

| Script | Description |
|---|---|
| `npm start` | Start CAP server (production mode, no hot-reload) |
| `npm run watch` | Start CAP server with hot-reload (kills port 4004 first) |
| `npm run build` | Build for production (`cds build --production`) |

---

## 7. Environment Configuration

### `.cdsrc.json` (DEV config — not deployed)

```json
{
  "requires": {
    "db":   { "kind": "sqlite", "database": "db.sqlite" },
    "auth": {
      "kind": "mocked",
      "users": {
        "anonymous": { "roles": ["Admin", "Viewer", "authenticated-user"] },
        "*":         { "roles": ["Admin", "Viewer", "authenticated-user"] }
      }
    }
  },
  "server": { "port": 4004 }
}
```

### Production override (`package.json` cds block)

In production (`NODE_ENV=production`), CAP automatically switches to:
- `auth: xsuaa` — XSUAA JWT validation
- `db: postgres` — PostgreSQL (or SAP HANA via `@cap-js/hana`)

---

## 8. UI5 Tooling (Frontend only dev server)

If you want to develop the frontend independently with hot-reload:

```bash
cd app/findmyexpert
npm install
npm start          # starts on port 8080, proxies /api to localhost:4004
npm run start:sandbox  # opens directly at sandbox.html
```

> Requires CAP backend running on `localhost:4004`.

---

## 9. Known DEV Quirks

| Issue | Explanation |
|---|---|
| `Component-preload.js 404` | Normal in dev — no UI5 build done. Suppressable with `data-sap-ui-preload=""` (already set). |
| `db.sqlite` not in git | Intentional — use seed CSV files to recreate. |
| `node_modules` not in git | Run `npm install` after clone. |
