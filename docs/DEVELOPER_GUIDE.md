# Developer Guide

## Local Setup

### Prerequisites

- Node.js 22.x
- `npm i -g @sap/cds-dk` (CAP CLI)
- Git

### Clone & Install

```bash
git clone https://github.com/LINZO-AT/find-my-expert.git
cd find-my-expert
npm install
```

### Initial Database Setup (SQLite)

```bash
cds deploy --to sqlite
```

This creates `db.sqlite` in the project root and runs all schema migrations. Re-run after any changes to `db/schema.cds`.

### Start Development Server

```bash
cds watch
```

CAP watches for file changes and hot-reloads automatically.

Available endpoints:
- OData service: `http://localhost:4004/api/catalog`
- Fiori Search App: `http://localhost:4004/findmyexpert-search/webapp/index.html`
- Fiori Launchpad Sandbox: `http://localhost:4004/findmyexpert-search/webapp/test/flpSandbox.html`
- Manage Experts: `http://localhost:4004/findmyexpert-manage-experts/webapp/index.html`

## Authentication Modes

### Local Dev (No Auth)
By default, `cds watch` runs without authentication. Admin endpoints are accessible for easy local testing.

### Simulating XSUAA Locally
Add to `package.json` under `cds.requires`:
```json
"auth": {
  "kind": "mocked",
  "users": {
    "admin": { "password": "admin", "roles": ["Admin", "ExpertViewer"] },
    "viewer": { "password": "viewer", "roles": ["ExpertViewer"] }
  }
}
```
Then run `cds watch` — login at `/login` with those credentials.

### Production (XSUAA)
Automatically active when `VCAP_SERVICES` contains an `xsuaa` binding (BTP Cloud Foundry).

## SQLite vs PostgreSQL

| Feature | SQLite (dev) | PostgreSQL (prod) |
|---|---|---|
| Setup | Zero-config | Requires `@cap-js/postgres` + service binding |
| Migrations | `cds deploy --to sqlite` | Auto on startup via deployer module |
| Full-text search | Limited | Full PostgreSQL capabilities |
| Transactions | Single-process | Full ACID |

Switch to PostgreSQL locally (optional):
```bash
npm install @cap-js/postgres
export PG_USER=... PG_PASSWORD=... PG_HOST=localhost PG_DATABASE=findmyexpert
cds deploy --to postgres
cds watch
```

## Data Management

### Seed Data (CSV)

Place CSV files in `db/data/` following the naming convention `findmyexpert.<EntityName>.csv`.

Example: `db/data/findmyexpert.Topics.csv`
```csv
ID,name,description
<uuid>,AI,Artificial Intelligence & Machine Learning
<uuid>,BTP,SAP Business Technology Platform
```

Run `cds deploy --to sqlite` to import seed data.

### Adding a New Expert (via Fiori UI)
1. Open Manage Experts app
2. Click **Create** → fill in First Name, Last Name, Email, Location, Languages
3. Save (activates draft)
4. Open the expert → **Expert Roles** section → add solution + role combinations

### Adding a New Expert (via HTTP / REST)

```bash
# POST to AdminExperts (requires Admin role)
curl -X POST http://localhost:4004/api/catalog/AdminExperts \
  -H "Content-Type: application/json" \
  -d '{"firstName": "Max", "lastName": "Mustermann", "email": "max@sap.com", "location": "AT"}'
```

## Testing the searchExperts Action

```bash
curl -X POST http://localhost:4004/api/catalog/searchExperts \
  -H "Content-Type: application/json" \
  -d '{"query": "Signavio"}'
```

Expected: JSON array of matched experts with relevance scores.

## CDS Schema Changes

After any change to `db/schema.cds`:
1. `cds deploy --to sqlite` — rebuilds the SQLite schema
2. `cds watch` — restarts (or it auto-reloads)
3. Check the terminal for any CDS compilation errors before testing

## Adding a New Fiori App

1. `cds add fiori-app` or create manually under `app/<appname>/`
2. Add to `app/appconfig/fioriSandboxConfig.json` for local Launchpad
3. Add build modules to `mta.yaml`
4. Add route to `app/router/xs-app.json`

## Common Issues

| Issue | Fix |
|---|---|
| `cds watch` fails with syntax error | Check `db/schema.cds` and `srv/catalog-service.cds` for missing `;` or `}` |
| SQLite `no such column` after schema change | Re-run `cds deploy --to sqlite` |
| `searchExperts` returns empty | Ensure seed data is loaded and query tokens match field values |
| Fiori app shows no data | Check OData URL in `manifest.json` — should point to `/api/catalog` |
