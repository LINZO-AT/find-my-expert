# Find My Expert 🔍

**Internal SAP expert directory for SAP Austria** — find the right expert for any SAP product, solution or topic.

## Overview

Find My Expert is a SAP BTP application that maintains a searchable directory of SAP Austria's internal experts per SAP product and solution. It supports structured browsing via Fiori UI and AI-powered natural language search (Joule Skill, Phase 2).

## Architecture

```
┌─ Fiori Launchpad ────────────────────────────────────────┐
│  Find My Expert (Search)  · Manage Experts               │
│  Manage Roles             · Manage Topics & Solutions    │
└──────────────────────────────────────────────────────────┘
                         │ OData V4
┌─ CAP Backend (Node.js) ──────────────────────────────────┐
│  CatalogService /api/catalog  — read + searchExperts()   │
│  AdminService (via catalog)   — CRUD (Admin role)        │
└──────────────────────────────────────────────────────────┘
                         │
┌─ Database ────────────────────────────────────────────────┐
│  SQLite (local dev)  ·  PostgreSQL BTP (production)      │
└──────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | SAP CAP `@sap/cds ^9.x`, Node.js 22 |
| Frontend | SAP Fiori Elements LROP, SAPUI5 1.136+ |
| Theme | `sap_horizon` |
| OData | V4 |
| Database (dev) | SQLite (automatic) |
| Database (prod) | PostgreSQL via `@cap-js/postgres` |
| Auth | XSUAA via `@sap/xssec` |
| Deployment | SAP BTP Cloud Foundry, MTA |

## Local Development

```bash
git clone https://github.com/LINZO-AT/find-my-expert.git
cd find-my-expert
npm install
cds deploy --to sqlite
cds watch
```

Fiori Launchpad Sandbox: `http://localhost:4004/findmyexpert-search/webapp/test/flpSandbox.html`

## XSUAA Role Collections

| Role Collection | Access |
|---|---|
| `FindMyExpert_Viewer` | View and search experts |
| `FindMyExpert_Admin` | Full CRUD — experts, roles, solutions |

## BTP Deployment

See [docs/BTP_DEPLOYMENT.md](docs/BTP_DEPLOYMENT.md).

## Joule Integration (Phase 2)

See [docs/joule-skill/README.md](docs/joule-skill/README.md).

## Data Model

- **Topics** — 8 areas: AI, BDC, BTP, CloudERP, HCM, Integrated Toolchain, RISE, T&I
- **Solutions** — SAP products per topic (Signavio, LeanIX, S/4HANA, ...)
- **Experts** — SAP Austria staff with contact info and languages
- **Roles** — Expert role types with relevance priority
- **ExpertRoles** — Expert ↔ Solution with role and presentation capabilities

---
*SAP Austria — Services Architecture Team*
