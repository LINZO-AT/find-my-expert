# BTP Deployment Guide

Deploy **Find My Expert** to SAP Business Technology Platform (Cloud Foundry).

---

## Overview

```
SAP BTP (Cloud Foundry)
├── find-my-expert-srv      ← CAP Node.js backend
├── find-my-expert-app      ← SAPUI5 static files (via AppRouter)
├── find-my-expert-approuter← SAP AppRouter
├── XSUAA service instance  ← Authentication
├── PostgreSQL service      ← Database (or SAP HANA)
└── HTML5 Repository        ← (optional, for Build Work Zone)
```

---

## Prerequisites

- SAP BTP subaccount with Cloud Foundry space
- SAP BTP CLI (`cf`) installed and logged in
- `mbt` (MTA Build Tool): `npm i -g mbt`
- SAP Build Work Zone subscription (for Launchpad integration)

---

## 1. Create XSUAA Service Instance

```bash
cf create-service xsuaa application find-my-expert-xsuaa \
  -c xs-security.json
```

The `xs-security.json` defines:
- Scope `$XSAPPNAME.Admin`
- Scope `$XSAPPNAME.Viewer`
- Role Templates `Admin`, `Viewer`
- Role Collections `FindMyExpert_Admin`, `FindMyExpert_Viewer`

---

## 2. Assign Role Collections to Users

In BTP Cockpit:

1. Navigate to **Security → Role Collections**
2. Find `FindMyExpert_Admin` or `FindMyExpert_Viewer`
3. Click **Edit → Add Users**
4. Enter the user's email and confirm

| Role Collection | Who should get it |
|---|---|
| `FindMyExpert_Admin` | Data owners, content managers |
| `FindMyExpert_Viewer` | All SAP Austria employees |

---

## 3. Create PostgreSQL (or HANA) Service

### Option A: PostgreSQL (recommended for BTP Trial/Standard)

```bash
cf create-service postgresql-db trial find-my-expert-db
# or for productive:
cf create-service postgresql-db standard find-my-expert-db
```

### Option B: SAP HANA Cloud

```bash
cf create-service hana hdi-shared find-my-expert-db
```

> If using HANA, replace `@cap-js/postgres` with `@cap-js/hana` in `package.json`.

---

## 4. Build the MTA Archive

```bash
# From the project root
mbt build
# Creates: mta_archives/findmyexpert_1.0.0.mtar
```

> An `mta.yaml` must be present. See [mta.yaml reference](#mtayaml-template) below.

---

## 5. Deploy

```bash
cf deploy mta_archives/findmyexpert_1.0.0.mtar
```

---

## 6. Deploy to SAP Build Work Zone

### Step 1: Add HTML5 Repository service

```bash
cf create-service html5-apps-repo app-runtime find-my-expert-html5
```

### Step 2: Configure `xs-app.json` for Work Zone

The `app/findmyexpert/xs-app.json` routes are already configured:

```json
{
  "routes": [
    { "source": "^/api/admin/(.*)", "destination": "srv-api", "authenticationType": "xsuaa" },
    { "source": "^/api/catalog/(.*)", "destination": "srv-api", "authenticationType": "xsuaa" },
    { "source": "^/(.*)", "localDir": "webapp", "authenticationType": "xsuaa" }
  ]
}
```

### Step 3: Add app to Content Provider

In SAP Build Work Zone → **Content Manager**:
1. Add Content Provider pointing to your HTML5 app repository
2. The `manifest.json` crossNavigation inbound `findmyexpert-display` registers the tile
3. Add tile to your Launchpad site

---

## 7. Joule Skill Integration (AI Expert Search)

The `searchExperts` CAP action (`POST /api/catalog/searchExperts`) is the backend for Joule skill integration.

### Setup

1. Create a Joule Skill in SAP AI Core referencing the endpoint
2. The action accepts `{ "query": "string" }` and returns ranked expert results
3. Ensure the Joule service binding is configured to pass XSUAA tokens

### Action contract

```http
POST /api/catalog/searchExperts
Authorization: Bearer <xsuaa-token>
Content-Type: application/json

{ "query": "S/4HANA Finance expert Austria" }
```

Response:
```json
{
  "value": [
    {
      "expertId": "e-001",
      "firstName": "Thomas",
      "lastName": "Hartmann",
      "topicName": "CloudERP",
      "solutionName": "S/4HANA Finance",
      "role": "TOPIC_OWNER",
      "roleLabel": "Topic Owner",
      "score": 100,
      ...
    }
  ]
}
```

---

## 8. `mta.yaml` Template

Create `mta.yaml` in the project root:

```yaml
_schema-version: "3.1"
ID: find-my-expert
version: 1.0.0
description: Find My Expert — SAP Austria Internal Expert Directory

modules:
  - name: find-my-expert-srv
    type: nodejs
    path: .
    parameters:
      buildpack: nodejs_buildpack
      memory: 256M
    build-parameters:
      builder: npm
      build-result: .
      commands:
        - npm ci --production
        - npx cds build --production
    provides:
      - name: srv-api
        properties:
          srv-url: ${default-url}
    requires:
      - name: find-my-expert-xsuaa
      - name: find-my-expert-db

  - name: find-my-expert-app
    type: html5
    path: app/findmyexpert
    build-parameters:
      builder: custom
      commands:
        - npm ci
        - npx ui5 build --clean-dest
      supported-platforms: []
    requires:
      - name: find-my-expert-html5

  - name: find-my-expert-approuter
    type: approuter.nodejs
    path: app
    parameters:
      memory: 128M
    requires:
      - name: find-my-expert-xsuaa
      - name: find-my-expert-html5
        parameters:
          service-key:
            config:
              xsappname: find-my-expert
      - name: srv-api
        group: destinations
        properties:
          name: srv-api
          url: ~{srv-url}
          forwardAuthToken: true

resources:
  - name: find-my-expert-xsuaa
    type: org.cloudfoundry.managed-service
    parameters:
      service: xsuaa
      service-plan: application
      path: ./xs-security.json

  - name: find-my-expert-db
    type: org.cloudfoundry.managed-service
    parameters:
      service: postgresql-db
      service-plan: trial

  - name: find-my-expert-html5
    type: org.cloudfoundry.managed-service
    parameters:
      service: html5-apps-repo
      service-plan: app-runtime
```

---

## 9. Environment Variables (CAP Production)

When `NODE_ENV=production`, CAP automatically reads:

| Variable | Value |
|---|---|
| `VCAP_SERVICES` | Injected by CF — contains XSUAA + DB credentials |
| `NODE_ENV` | `production` |

No manual config needed — XSUAA and PostgreSQL are auto-discovered from `VCAP_SERVICES`.

---

## 10. Post-Deployment Verification

```bash
# Check app status
cf apps
cf logs find-my-expert-srv --recent

# Test endpoints
curl https://<your-app>.cfapps.eu10.hana.ondemand.com/api/catalog/
curl -H "Authorization: Bearer <token>" https://<your-app>.cfapps.eu10.hana.ondemand.com/api/catalog/userInfo\(\)
```
