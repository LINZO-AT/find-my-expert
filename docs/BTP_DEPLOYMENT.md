# BTP Deployment Guide — Find My Expert

## Architecture Overview

Find My Expert runs on SAP BTP Cloud Foundry with **SAP Build Work Zone, Standard Edition** as the Fiori Launchpad shell. Work Zone provides the managed AppRouter — no standalone CF AppRouter is deployed.

```
┌─────────────────────────────────────────────────────────────┐
│           SAP Build Work Zone, Standard Edition              │
│  (Managed AppRouter + Launchpad Shell + Site Manager)        │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Expert Search│  │Manage Experts│  │Manage Roles/Topics│  │
│  │  (Viewer)    │  │  (Admin)     │  │  (Admin)          │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
│         └─────────────────┴──────────────────┘             │
│                    HTML5 App Repository                      │
└──────────────────────────┬──────────────────────────────────┘
                           │ OData V4 (OAuth2UserTokenExchange)
                           ▼
               ┌───────────────────────┐
               │   CAP Backend (srv)   │
               │   /api/catalog        │◄──── Joule Skill
               └───────────┬───────────┘      (via BTP Destination)
                           │
                           ▼
               ┌───────────────────────┐
               │  PostgreSQL or HANA   │
               │  (see Database Options│
               │   section below)      │
               └───────────────────────┘
```

---

## Database Options

This project supports **two database backends** for production deployment on SAP BTP:

| Option | MTA File | CDS Plugin | CDS Kind | Service Plan | Best For |
|--------|----------|------------|----------|-------------|----------|
| **A — PostgreSQL** (default) | `mta.yaml` | `@cap-js/postgres` | `postgres` | `postgresql-db / standard` | Hyperscaler environments, cost-effective |
| **B — SAP HANA Cloud** | `mta-hana.yaml` | `@sap/cds-hana` | `hana` | `hana / hdi-shared` | HANA-native features, full BTP integration |

> **Choose one variant** — both MTA files are provided in the project root.

### Database Comparison

| Feature | PostgreSQL | SAP HANA Cloud |
|---------|-----------|----------------|
| **MTA File** | `mta.yaml` | `mta-hana.yaml` |
| **CDS Plugin** | `@cap-js/postgres` | `@sap/cds-hana` |
| **CDS kind** | `postgres` | `hana` |
| **DB Resource Type** | `org.cloudfoundry.managed-service` | `com.sap.xs.hdi-container` |
| **Deployer Type** | `nodejs` (task-based) | `hdb` (automatic) |
| **Cost (Dev)** | Free (`trial` plan) | Free (`hana-free` 30 GB) |
| **Cost (Prod)** | ~€50–200/month | ~€400–1,500+/month |
| **Native HANA features** | ❌ | ✅ (Calc views, fuzzy search, etc.) |
| **Hyperscaler portability** | ✅ (AWS, Azure, GCP) | ❌ (SAP HANA only) |
| **HDI Container** | ❌ | ✅ |
| **Schema migration** | via `cds-deploy` task | Automatic via `hdb` deployer |

---

## Prerequisites

### BTP Entitlements Required

**Common (both variants):**

| Service | Plan | Purpose |
|---------|------|---------|
| SAP Authorization & Trust Management (XSUAA) | `application` | Auth & authorization |
| HTML5 Application Repository | `app-host` + `app-runtime` | UI app hosting |
| **SAP Build Work Zone, standard edition** | `standard` | Launchpad shell + managed AppRouter |

**Option A — PostgreSQL:**

| Service | Plan | Purpose |
|---------|------|---------|
| PostgreSQL on SAP BTP | `standard` (or `trial`) | Managed PostgreSQL database |

**Option B — SAP HANA Cloud:**

| Service | Plan | Purpose |
|---------|------|---------|
| SAP HANA Cloud (tooling) | `tools` | HANA Cloud Central — management UI for creating DB instances |
| SAP HANA Cloud (database) | `hana` (or `hana-free`) | HANA Cloud database instance |
| SAP HANA Schemas & HDI Containers | `hdi-shared` | HDI container for schema deployment |

> ⚠️ The Work Zone service name in BTP is `SAPLaunchpad` with plan `standard` (Work Zone Standard Edition). Not `portal`.

### Required Tools

```bash
# Cloud Foundry CLI
cf --version  # >= 8.x

# MultiApps CF CLI Plugin
cf install-plugin multiapps

# MTA Build Tool
npm install -g mbt
mbt --version
```

---

## Project Structure

```
find-my-expert/
├── app/
│   ├── findmyexpert-search/          # Expert Search UI (Viewer role)
│   ├── findmyexpert-manage-experts/  # Manage Experts UI (Admin role)
│   ├── findmyexpert-manage-roles/    # Manage Roles UI (Admin role)
│   ├── findmyexpert-manage-topics/   # Manage Topics UI (Admin role)
│   ├── router/                       # AppRouter config (local dev only)
│   └── appconfig/                    # FLP sandbox config (local dev only)
├── flp/
│   └── cdm.json                      # Work Zone CDM content descriptor
├── srv/                              # CAP backend service
├── db/                               # DB schema + seed data
├── docs/                             # Documentation
├── mta.yaml                          # MTA descriptor — PostgreSQL variant
├── mta-hana.yaml                     # MTA descriptor — SAP HANA variant
├── xs-security.json                  # XSUAA role config
└── package.json
```

---

## Step 1: Subscribe to SAP Build Work Zone

Before first deployment, manually subscribe:

1. **BTP Cockpit → Services → Service Marketplace**
2. Search for **SAP Build Work Zone, standard edition**
3. Click **Create** → Plan: `standard` (Application)
4. Assign yourself the role collection **`Launchpad_Admin`** in BTP Cockpit → Security → Role Collections

---

## Step 2: Database Setup

### Option A: PostgreSQL (Default)

No additional setup needed — the `postgresql-db` service instance is created automatically during MTA deployment.

**package.json** already includes the correct production profile:

```json
{
  "cds": {
    "requires": {
      "db": {
        "[production]": {
          "kind": "postgres"
        }
      }
    }
  }
}
```

**Dependency** (already in `package.json`):

```bash
npm install @cap-js/postgres
```

### Option B: SAP HANA Cloud

#### 2B.1 Provision a HANA Cloud Instance

**Prerequisite:** You need the **SAP HANA Cloud** tooling subscription (`hana-cloud-tools` / plan `tools`) in your BTP subaccount. This provides **SAP HANA Cloud Central** — the management UI for creating and managing HANA database instances.

If not yet subscribed:
1. **BTP Cockpit → Service Marketplace** → search for **SAP HANA Cloud**
2. Click **Create** → Plan: `tools` (Application)
3. Assign yourself the role collection **`SAP HANA Cloud Administrator`**

**Create a HANA database instance:**

1. **BTP Cockpit → Instances and Subscriptions** → click on **SAP HANA Cloud** (`tools`) → **Open Application** (opens SAP HANA Cloud Central)
2. Click **Create Instance** → Type: **SAP HANA Cloud, SAP HANA Database**
3. Choose memory/storage size:
   - `hana-free`: 30 GB memory, 120 GB storage (free tier)
   - Production: 32 GB+ memory (paid)
4. Under **Connections** → **Allow all IP addresses** (or restrict to your CF landscape)
5. Map the instance to your **Cloud Foundry Organization + Space** (required for HDI container binding)
6. Click **Create Instance** — provisioning takes ~10–15 minutes

> ⚠️ The `hana-free` plan auto-stops after 30 days of inactivity and must be manually restarted from SAP HANA Cloud Central.

> ℹ️ Once a HANA Cloud instance is mapped to your CF Space, the `hana` service with plan `hdi-shared` becomes available for HDI container creation during MTA deployment.

#### 2B.2 Install the HANA CDS Plugin

```bash
npm install @sap/cds-hana
```

#### 2B.3 Configure the CDS Production Profile

You can either **override** the `[production]` profile or use a **dedicated `[hana]` profile**:

**Option 1 — Override production (simple, single DB):**

```json
{
  "cds": {
    "requires": {
      "db": {
        "[production]": {
          "kind": "hana"
        }
      }
    }
  }
}
```

**Option 2 — Separate profiles (recommended, supports both DBs side by side):**

```json
{
  "cds": {
    "requires": {
      "db": {
        "[production]": { "kind": "postgres" },
        "[hana]":       { "kind": "hana" }
      }
    }
  }
}
```

With Option 2, build with: `CDS_ENV=hana mbt build -e mta-hana.yaml`

#### HANA MTA Configuration (`mta-hana.yaml`)

Key differences from the PostgreSQL MTA:

```yaml
# Database Resource — HDI Container
resources:
  - name: find-my-expert-db
    type: com.sap.xs.hdi-container
    parameters:
      service: hana
      service-plan: hdi-shared
```

```yaml
# Database Deployer — type: hdb (instead of nodejs + task)
modules:
  - name: find-my-expert-db-deployer
    type: hdb
    path: gen/db
    parameters:
      buildpack: nodejs_buildpack
      memory: 256M
      disk-quota: 512M
    requires:
      - name: find-my-expert-db
```

> The `hdb` module type handles schema deployment automatically — no separate task definition needed (unlike the PostgreSQL variant which uses `npx cds-deploy` as a CF task).

---

## Accessing the SAP HANA Database

After deploying with the HANA variant (`mta-hana.yaml`), an **HDI container** is created and bound to the `find-my-expert-srv` and `find-my-expert-db-deployer` modules. This section explains how to access and interact with the HANA database.

### Option 1: SAP HANA Database Explorer (Browser)

The easiest way to browse data and run SQL is the built-in **Database Explorer** in SAP HANA Cloud Central.

1. **BTP Cockpit → Instances and Subscriptions** → click **SAP HANA Cloud** (`tools`) → **Open Application**
2. In SAP HANA Cloud Central, locate your HANA instance → click **Actions (⋮) → Open in SAP HANA Database Explorer**
3. Database Explorer opens in a new tab — you can:
   - Browse the **HDI container schema** (tables, views, procedures)
   - Open a **SQL Console** to run queries directly
   - Export/import data

> ℹ️ To see the HDI container tables, you need to add the HDI container as a database connection in Database Explorer. Use **+ Add Database** → **SAP HANA Database** → provide the HDI container credentials (see Option 2 below for how to retrieve them).

#### Finding HDI Container Tables

HDI container tables follow the CDS naming convention with underscores:

| CDS Entity | HDI Container Table |
|---|---|
| `findmyexpert.Experts` | `FINDMYEXPERT_EXPERTS` |
| `findmyexpert.Topics` | `FINDMYEXPERT_TOPICS` |
| `findmyexpert.Solutions` | `FINDMYEXPERT_SOLUTIONS` |
| `findmyexpert.ExpertRoles` | `FINDMYEXPERT_EXPERTROLES` |
| `findmyexpert.ExpertLanguages` | `FINDMYEXPERT_EXPERTLANGUAGES` |
| `findmyexpert.Roles` | `FINDMYEXPERT_ROLES` |

> ⚠️ HANA table names are **uppercase** by default (unlike PostgreSQL which uses lowercase).

### Option 2: CF Service Key (Credentials for External Access)

Create a **service key** to obtain the HANA HDI container credentials. These credentials can be used with any HANA client tool (Database Explorer, `hdbsql`, DBeaver, etc.).

```bash
# Create a service key for the HDI container
cf create-service-key find-my-expert-db hdi-access-key

# View the credentials
cf service-key find-my-expert-db hdi-access-key
```

The output contains the connection details:

```json
{
  "host": "<instance-id>.hana.trial-us10.hanacloud.ondemand.com",
  "port": "443",
  "schema": "<HDI_CONTAINER_SCHEMA>",
  "user": "<HDI_CONTAINER_USER>",
  "password": "<HDI_CONTAINER_PASSWORD>",
  "driver": "com.sap.db.jdbc.Driver",
  "url": "jdbc:sap://<host>:443?encrypt=true&validateCertificate=true&currentschema=<schema>",
  "certificate": "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----",
  "hdi_user": "<HDI_DT_USER>",
  "hdi_password": "<HDI_DT_PASSWORD>"
}
```

**Key fields:**
- `host` / `port` — HANA Cloud endpoint (always port `443` with TLS)
- `user` / `password` — Runtime user (for SELECT/INSERT/UPDATE/DELETE)
- `hdi_user` / `hdi_password` — Design-time user (for HDI deployment operations)
- `schema` — The HDI container schema name

### Option 3: `hdbsql` CLI (Command Line)

The **`hdbsql`** command-line tool allows SQL access from your terminal. It is included in the [SAP HANA Client](https://tools.hana.ondemand.com/#hanatools) installation.

```bash
# Install SAP HANA Client (if not already installed)
# Download from: https://tools.hana.ondemand.com/#hanatools

# Connect using credentials from the service key (Option 2)
hdbsql -n <host>:443 -u <user> -p <password> -e -sslprovider commoncrypto -ssltrustcert

# Once connected, set schema and run queries
\s <HDI_CONTAINER_SCHEMA>
SELECT * FROM "FINDMYEXPERT_EXPERTS";
SELECT * FROM "FINDMYEXPERT_TOPICS";

# One-liner: run a query directly
hdbsql -n <host>:443 -u <user> -p <password> -e -sslprovider commoncrypto -ssltrustcert \
  "SELECT \"FIRSTNAME\", \"LASTNAME\", \"EMAIL\" FROM \"<schema>\".\"FINDMYEXPERT_EXPERTS\""
```

> ⚠️ HANA requires **double-quoted identifiers** for case-sensitive table and column names.

### Option 4: Local Hybrid Testing (`cds bind`)

For **local development against the deployed HANA database**, use `cds bind` to connect your local CAP server to the cloud HDI container.

#### Step 1: Bind to the deployed HANA service

```bash
# Ensure you are logged in to CF
cf login -a https://api.cf.<region>.hana.ondemand.com

# Bind the local project to the deployed HDI container
cds bind -2 find-my-expert-db

# This also binds XSUAA if needed
cds bind -2 find-my-expert-auth
```

This creates a `.cdsrc-private.json` file (git-ignored) with binding metadata:

```json
{
  "requires": {
    "[hybrid]": {
      "db": {
        "binding": {
          "type": "cf",
          "apiEndpoint": "https://api.cf.<region>.hana.ondemand.com",
          "org": "your-org",
          "space": "your-space",
          "instance": "find-my-expert-db",
          "key": "find-my-expert-db-key",
          "resolved": false
        }
      }
    }
  }
}
```

#### Step 2: Run the CAP server with hybrid profile

```bash
# Start the local server connected to the cloud HANA database
cds watch --profile hybrid
```

The local server now uses the **deployed HANA HDI container** as its database — all reads and writes go to the cloud database.

#### Step 3: Inspect resolved credentials (optional)

```bash
# Display the resolved HANA credentials
cds env get requires.db.credentials --profile hybrid --resolve-bindings
```

#### Using `cds bind --exec` for other tools

You can also inject the HANA credentials into any process via `VCAP_SERVICES`:

```bash
# Run hdbsql with auto-injected credentials
cds bind --exec -- hdbsql -n \$HANA_HOST:443 -u \$HANA_USER -p \$HANA_PASSWORD

# Run a Node.js script with HANA credentials available
cds bind --exec -- node scripts/migrate-data.js
```

### Quick Reference: Database Access Methods

| Method | Best For | Prerequisites |
|--------|----------|--------------|
| **Database Explorer** (Browser) | Ad-hoc queries, browsing schema, data export | HANA Cloud Central subscription |
| **CF Service Key** | Extracting credentials for any client tool | CF CLI, deployed HDI container |
| **`hdbsql` CLI** | Scripted queries, automation, data import | SAP HANA Client installed |
| **`cds bind` + `cds watch`** | Local development against cloud HANA | CF CLI, `cds-dk` installed |
| **DBeaver / HANA Studio** | GUI-based database management | Service key credentials, JDBC driver |

> 💡 **Tip:** For day-to-day development, use `cds bind` with `cds watch --profile hybrid`. For production debugging or data inspection, use SAP HANA Database Explorer via HANA Cloud Central.

---

## Step 3: Build the MTA Archive

```bash
# ── Option A: PostgreSQL (default) ──
mbt build -t gen --mtar find-my-expert.mtar

# ── Option B: HANA ──
CDS_ENV=hana mbt build -e mta-hana.yaml -t gen --mtar find-my-expert.mtar
```

What happens:
- Runs `npm ci` + `npx cds build --production`
- Builds each UI5 app into a `.zip`
- Packages everything into `gen/find-my-expert.mtar`

> If you use a dedicated `[hana]` profile (Option 2 above), you **must** set `CDS_ENV=hana` during build so that CDS generates HANA-compatible artifacts instead of PostgreSQL ones.

---

## Step 4: Login to Cloud Foundry

```bash
cf login -a https://api.cf.<region>.hana.ondemand.com
# Select org and space
```

---

## Step 5: Deploy

```bash
cf deploy gen/find-my-expert.mtar
```

### Deployment Modules (PostgreSQL)

| Module | Type | What it does |
|--------|------|-------------|
| `find-my-expert-srv` | Node.js | CAP backend |
| `find-my-expert-db-deployer` | Node.js (task) | Database schema deployment via `cds-deploy` |
| `findmyexpert-search` etc. | HTML5 | Builds UI5 apps |
| `find-my-expert-app-content` | Content deployer | Uploads UI5 zips to HTML5 Repo |
| `find-my-expert-flp-content` | Content deployer | Deploys CDM to Work Zone |
| `find-my-expert-destinations` | Content deployer | Creates destinations in Work Zone |

### Deployment Modules (HANA)

| Module | Type | What it does |
|--------|------|-------------|
| `find-my-expert-srv` | Node.js | CAP backend |
| `find-my-expert-db-deployer` | **hdb** | HDI container schema deployment (automatic) |
| `findmyexpert-search` etc. | HTML5 | Builds UI5 apps |
| `find-my-expert-app-content` | Content deployer | Uploads UI5 zips to HTML5 Repo |
| `find-my-expert-flp-content` | Content deployer | Deploys CDM to Work Zone |
| `find-my-expert-destinations` | Content deployer | Creates destinations in Work Zone |

> **No standalone AppRouter CF app** — Work Zone Standard Edition uses a managed AppRouter automatically.

### Alternative: Using an Existing PostgreSQL Instance

If a `postgresql-db` service instance already exists in your CF Space (e.g., shared with other apps), you can reuse it instead of creating a new one.

**Step 5a: Adjust `mta.yaml`**

Change the DB resource type from `managed-service` to `existing-service`:

```yaml
resources:
  - name: find-my-expert-db
    type: org.cloudfoundry.existing-service
    parameters:
      service-name: my-existing-postgres   # ← exact name of the existing instance
```

> Replace `my-existing-postgres` with the actual service instance name. Verify with `cf services`.

**Schema & Table Naming:**

- CAP deploys all tables into the `public` schema of the PostgreSQL database
- Table names follow CDS slugification (dots → underscores):

| CDS Entity | PostgreSQL Table |
|---|---|
| `findmyexpert.Experts` | `findmyexpert_Experts` |
| `findmyexpert.Topics` | `findmyexpert_Topics` |
| `findmyexpert.Solutions` | `findmyexpert_Solutions` |
| `findmyexpert.ExpertRoles` | `findmyexpert_ExpertRoles` |
| `findmyexpert.ExpertLanguages` | `findmyexpert_ExpertLanguages` |
| `findmyexpert.Roles` | `findmyexpert_Roles` |

**Important notes for existing databases with data:**

- If tables **don't exist** yet → `cds-deploy` creates them + loads CSV seed data
- If tables **already exist** → schema migration via `ALTER TABLE` (additive changes only)
- CSV seed data is **not** re-imported into existing non-empty tables
- **Always back up** your database before the first deployment: `cf create-service-key <instance> backup-key && pg_dump ...`

**Shared instances from another CF Space:**

```bash
# In the source space (where the DB lives):
cf share-service my-existing-postgres -s target-space

# Then use the same existing-service config in mta.yaml as above
```

---

## Step 6: Assign Role Collections

In **BTP Cockpit → Security → Role Collections**, assign to users:

| Role Collection | Access |
|----------------|--------|
| `FindMyExpert_Viewer` | Expert Search (read-only) |
| `FindMyExpert_Admin` | Full CRUD: Experts, Roles, Topics + Search |

---

## Step 7: Work Zone Setup (Post-Deploy)

### 7.1 Open Work Zone Site Manager

1. **BTP Cockpit → Services → Instances and Subscriptions**
2. Click on **SAP Build Work Zone, standard edition** → Open

### 7.2 Fetch Updated Content (Channel Manager)

1. In Work Zone Admin → **Channel Manager** (left sidebar)
2. Find the **HTML5 Apps** content provider
3. Click the **refresh/fetch** icon → **Fetch updated content**
4. Wait until status shows **Updated**

This pulls in all 4 apps deployed via the MTA.

### 7.3 Add Apps to Content (Content Manager)

1. **Content Manager → Content Explorer**
2. Click on **HTML5 Apps**
3. Select all 4 apps:
   - `findmyexpertSearch` — Expert Search
   - `findmyexpertManageExperts` — Manage Experts
   - `findmyexpertManageRoles` — Manage Roles
   - `findmyexpertManageTopics` — Manage Topics
4. Click **Add to My Content**

### 7.4 Assign Apps to Roles

1. **Content Manager → My Content → Roles**
2. Edit the **Everyone** role → assign **Expert Search** (visible to all authenticated users)
3. Create or edit a **FindMyExpert_Admin** role → assign all 4 apps
4. Map this role to the `FindMyExpert_Admin` role collection from BTP

> The CDM deployment (`flp/cdm.json`) also creates a **catalog** and **group** automatically. Check Content Manager → My Content to verify.

### 7.5 Open or Create a Site

1. **Site Directory → Create Site** (or open existing)
2. Name it e.g. **"SAP Austria Portal"**
3. Open the site — apps appear as tiles in the Launchpad

---

## Step 8: Joule Skill Setup

### Prerequisites
- BTP subaccount with **Joule** entitlement + **SAP Build Process Automation** (build-default plan)
- Joule Booster completed (Global Account → Boosters → "Setting Up Joule")
- Find My Expert backend deployed (Steps 1–6 above)

### 8.1 Create BTP Destination

**BTP Cockpit → Connectivity → Destinations → New Destination:**

| Property | Value |
|----------|-------|
| Name | `FINDMYEXPERT_BACKEND` |
| Type | `HTTP` |
| URL | `https://<find-my-expert-srv-route>/api/catalog` |
| Proxy Type | `Internet` |
| Authentication | `OAuth2UserTokenExchange` |
| Token Service URL | `https://<xsuaa-subdomain>.authentication.<region>.hana.ondemand.com/oauth/token` |
| Client ID | from XSUAA service key |
| Client Secret | from XSUAA service key |

**Required Additional Properties:**

| Property | Value |
|----------|-------|
| `sap.processautomation.enabled` | `true` |
| `HTML5.DynamicDestination` | `true` |
| `WebIDEEnabled` | `true` |

> ⚠️ Without `sap.processautomation.enabled = true` the destination is **invisible** in Joule Studio — no error, just not listed.

Get the srv URL and XSUAA credentials:
```bash
cf app find-my-expert-srv | grep routes
cf create-service-key find-my-expert-auth joule-key
cf service-key find-my-expert-auth joule-key
```

### 8.2 Register Destination in SAP Build

1. **SAP Build Lobby → Control Tower → Destinations**
2. Click **Open in BTP Cockpit** — verify `FINDMYEXPERT_BACKEND` appears
3. **Control Tower → Environments → Create/select environment**
4. Add `FINDMYEXPERT_BACKEND` to the environment
5. Click **Check Connection** — confirm green checkmark

### 8.3 Create Action Project

1. **SAP Build Lobby → Connectors → Actions → Create**
2. API Source: **SAP Cloud Application Programming Model**
3. Browse OData Destinations → select `FINDMYEXPERT_BACKEND`
4. Name: `FindMyExpert Actions`
5. Select the action **`POST searchExperts`**
6. Input: `query` (String, required)
7. Output: `firstName`, `lastName`, `email`, `solutionName`, `topicName`, `roleName`, `reasoning`, `score`
8. **Test** with a sample query to validate
9. **Save → Release → Publish to Library**

> ⚠️ Actions must be **Published to Library** — released but unpublished actions don't appear in Skill Builder.

### 8.4 Build the Joule Skill

1. **SAP Build Lobby → Create → Joule Skill**
2. Name: `FindMyExpert`
3. **Description** (critical — Joule uses this for intent matching):
   ```
   Find SAP Austria experts by product, solution, or topic.
   Use when a user asks: "Who is my expert for [product]?",
   "Find an expert for [topic]", "Wer ist mein Experte für [Produkt]?",
   "Welcher Experte kann [Produkt] präsentieren?", or
   "Show me experts for [solution]".
   Returns qualified SAP Austria consultants with contact details
   and presentation capabilities.
   ```
4. **Trigger** → define input parameter `query` (String)
5. **Call Action** → Browse All Actions → select `POST searchExperts`
6. Map: `query` → `query`
7. **Send Message** → Open Message Editor:
   - Title: `Expert Recommendations`
   - Text:
     ```
     Found {{results.length}} expert(s) for "{{query}}":

     {{#each results}}
     **{{firstName}} {{lastName}}** — {{roleName}}
     Solution: {{solutionName}} | Topic: {{topicName}}
     Contact: {{email}}
     {{#if reasoning}}→ {{reasoning}}{{/if}}

     {{/each}}
     ```
8. **Save → Release → Deploy** → select environment → map destination `FINDMYEXPERT_BACKEND`

### 8.5 Test in Joule

**SAP Build → Control Tower → Environments → your environment → Joule → Launch**

Example queries:
- `"Find me an expert for BTP Integration Suite"`
- `"Wer ist mein Experte für S/4HANA Finance?"`
- `"Who can present about AI in SAP?"`
- `"Find a German-speaking expert for Signavio"`

---

## Cost Considerations

### PostgreSQL Variant

| Service | Plan | Estimated Cost |
|---------|------|---------------|
| PostgreSQL | `trial` | Free |
| PostgreSQL | `standard` | ~€50–200/month |
| XSUAA | `application` | Free |
| HTML5 Repo | `app-host` | Free (included) |
| Work Zone | `standard` | Included in BTP license |

### SAP HANA Cloud Variant

| Service | Plan | Estimated Cost |
|---------|------|---------------|
| HANA Cloud | `hana-free` (30 GB) | Free (auto-stops after 30 days inactivity) |
| HANA Cloud | `hana` (production) | ~€400–1,500+/month (depends on memory/storage) |
| HDI Container | `hdi-shared` | Free (included with HANA Cloud) |
| XSUAA | `application` | Free |
| HTML5 Repo | `app-host` | Free (included) |
| Work Zone | `standard` | Included in BTP license |

> **Tip (PostgreSQL):** Start with `trial` plan for development, switch to `standard` for production.
>
> **Tip (HANA):** Use `hana-free` for development/testing. Switch to a production-sized instance for go-live.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| **403 Forbidden** | Check role collection assignments in BTP Cockpit |
| **404 Not Found** | Verify HTML5 repo: `cf html5-list -di find-my-expert-repo-host -u` |
| **Apps not visible in Work Zone** | Channel Manager → Fetch updated content; Content Manager → Add to My Content |
| **502 Bad Gateway** | Check srv logs: `cf logs find-my-expert-srv --recent` |
| **PostgreSQL connection error** | Verify PostgreSQL service binding: `cf services` |
| **HANA connection error** | Verify HDI container binding: `cf services`; check if HANA instance is running in BTP Cockpit |
| **HANA deployer failed** | Ensure `@sap/cds-hana` is installed: `npm install @sap/cds-hana` |
| **No HANA instance found** | Provision SAP HANA Cloud instance in BTP subaccount first |
| **Wrong DB artifacts generated** | Ensure `CDS_ENV=hana` is set during build when using `[hana]` profile |
| **Joule destination not visible** | Add `sap.processautomation.enabled = true` to destination additional properties |
| **Joule action not in Skill Builder** | Action must be **Published to Library**, not just Released |
| **Work Zone deploy fails** | Verify `SAPLaunchpad` service entitlement exists in subaccount (not `portal`) |

### Useful Commands

```bash
# Check all deployed apps
cf apps

# Check service instances
cf services

# View CAP server logs
cf logs find-my-expert-srv --recent

# List HTML5 apps in repository
cf html5-list -di find-my-expert-repo-host -u

# Get srv URL
cf app find-my-expert-srv | grep routes

# Create XSUAA service key (for Joule destination)
cf create-service-key find-my-expert-auth joule-key
cf service-key find-my-expert-auth joule-key

# Restage after config change
cf restage find-my-expert-srv