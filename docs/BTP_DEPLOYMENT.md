# BTP Deployment Guide

> CAP 9 · PostgreSQL · XSUAA · HTML5 Repo · MTA

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | 22.x | [nodejs.org](https://nodejs.org) |
| `@sap/cds-dk` | latest | `npm i -g @sap/cds-dk` |
| Cloud Foundry CLI | v8+ | [CF CLI](https://docs.cloudfoundry.org/cf-cli/) |
| MTA Build Tool | latest | `npm i -g mbt` |
| `cf multiapps` plugin | latest | `cf install-plugin multiapps` |

## BTP Services Required

| Service | Plan | Binding |
|---|---|---|
| `postgresql-db` | `trial` | `findmyexpert-postgres` |
| `xsuaa` | `application` | `findmyexpert-auth` |
| `html5-apps-repo` | `app-host` | `findmyexpert-html5-repo` |
| `html5-apps-repo` | `app-runtime` | `findmyexpert-html5-runtime` |

## Step-by-Step Deployment

### 1. Login to Cloud Foundry

```bash
cf login -a https://api.cf.<region>.hana.ondemand.com
cf target -o <org> -s <space>
```

### 2. Create BTP Service Instances

```bash
cf create-service postgresql-db trial findmyexpert-postgres
cf create-service xsuaa application findmyexpert-auth -c xs-security.json
cf create-service html5-apps-repo app-host findmyexpert-html5-repo
cf create-service html5-apps-repo app-runtime findmyexpert-html5-runtime
```

Wait for services to be created:
```bash
cf services
```

### 3. Build the MTA Archive

```bash
npm install
mbt build -t dist/
```

This produces `dist/findmyexpert_1.0.0.mtar`.

### 4. Deploy

```bash
cf deploy dist/findmyexpert_1.0.0.mtar
```

Monitor progress:
```bash
cf mta findmyexpert
```

### 5. Post-Deployment

Seed initial data (if not using `data/*.csv`):
```bash
cf ssh findmyexpert-srv -c "cd app && node -e \"require('@sap/cds').connect().then(() => process.exit())\""
```

Check app status:
```bash
cf apps
cf logs findmyexpert-srv --recent
```

## Environment Variables

The CAP service automatically reads the `VCAP_SERVICES` binding. No manual `.env` setup needed in production.

For debugging, set:
```bash
cf set-env findmyexpert-srv DEBUG "cds:*"
cf restage findmyexpert-srv
```

## XSUAA Role Assignment

1. BTP Cockpit → Security → Role Collections
2. Assign `FindMyExpert_Viewer` to all users who need search access
3. Assign `FindMyExpert_Admin` to data stewards managing the directory

## Updating After Code Changes

```bash
mbt build -t dist/
cf deploy dist/findmyexpert_1.0.0.mtar --strategy rolling
```

## PostgreSQL Schema Migration

CAP auto-migrates the schema on startup via `@cap-js/postgres`. For breaking changes:
1. Update schema in `db/schema.cds`
2. Redeploy — CAP will run `cds deploy` against the bound PostgreSQL instance automatically via the `findmyexpert-db-deployer` module.

## Troubleshooting

| Symptom | Check |
|---|---|
| 403 on API calls | XSUAA scopes not assigned — check role collections |
| App crash on startup | `cf logs findmyexpert-srv --recent` — usually a missing service binding |
| DB migration error | Check `findmyexpert-db-deployer` logs: `cf logs findmyexpert-db-deployer --recent` |
| HTML5 apps not found | Ensure `findmyexpert-html5-repo` service is bound and deployer ran |
