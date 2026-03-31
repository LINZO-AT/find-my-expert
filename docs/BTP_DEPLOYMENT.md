# BTP Deployment Guide — Find My Expert

## Architecture Overview

Find My Expert runs on SAP BTP Cloud Foundry with **SAP Build Work Zone, Standard Edition** as the Fiori Launchpad shell. Work Zone provides the managed AppRouter — no standalone CF AppRouter is deployed.

> **Important:** SAP has blocked `content_endpoint` for Build Work Zone Standard Edition. Launchpad content (CDM) can no longer be deployed via MTA modules. Apps must be configured manually in **Work Zone Site Manager** (see Step 7).

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
               │   SAP HANA Cloud      │
               │   (HDI Container)     │
               └───────────────────────┘
```

---

## Prerequisites

### BTP Entitlements Required

| Service | Plan | Purpose |
|---------|------|---------|
| SAP Authorization & Trust Management (XSUAA) | `application` | Auth & authorization |
| HTML5 Application Repository | `app-host` + `app-runtime` | UI app hosting |
| SAP Build Work Zone, standard edition | `standard` | Launchpad shell + managed AppRouter |
| Destination Service | `lite` | Destination content deployment |
| SAP HANA Cloud (tooling) | `tools` | HANA Cloud Central — management UI |
| SAP HANA Cloud (database) | `hana` or `hana-free` | HANA Cloud database instance |
| SAP HANA Schemas & HDI Containers | `hdi-shared` | HDI container for schema deployment |

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
│   └── cdm.json                      # Work Zone CDM descriptor (local dev/reference only)
├── srv/                              # CAP backend service
├── db/                               # DB schema + seed data
├── docs/                             # Documentation
├── mta.yaml                          # MTA deployment descriptor
├── xs-security.json                  # XSUAA role config
└── package.json
```

> **Note:** `flp/cdm.json` is kept in the repository for local FLP sandbox testing (`npm run watch-flp`) but is **not deployed** to BTP. FLP tile/group configuration is done manually in Work Zone Site Manager.

---

## Step 1: Subscribe to SAP Build Work Zone

Before first deployment, manually subscribe:

1. **BTP Cockpit → Services → Service Marketplace**
2. Search for **SAP Build Work Zone, standard edition**
3. Click **Create** → Plan: `standard` (Application)
4. Assign yourself the role collection **`Launchpad_Admin`** in BTP Cockpit → Security → Role Collections

---

## Step 2: Provision SAP HANA Cloud

### 2.1 Subscribe to HANA Cloud Tooling

**Prerequisite:** You need the **SAP HANA Cloud** tooling subscription (`hana-cloud-tools` / plan `tools`) in your BTP subaccount. This provides **SAP HANA Cloud Central** — the management UI for creating and managing HANA database instances.

If not yet subscribed:
1. **BTP Cockpit → Service Marketplace** → search for **SAP HANA Cloud**
2. Click **Create** → Plan: `tools` (Application)
3. Assign yourself the role collection **`SAP HANA Cloud Administrator`**

### 2.2 Create a HANA Database Instance

1. **BTP Cockpit → Instances and Subscriptions** → click on **SAP HANA Cloud** (`tools`) → **Open Application** (opens SAP HANA Cloud Central)
2. Click **Create Instance** → Type: **SAP HANA Cloud, SAP HANA Database**
3. Choose memory/storage size:
   - `hana-free`: 30 GB memory, 120 GB storage (free tier)
   - Production: 32 GB+ memory (paid)
4. Under **Connections** → **Allow all IP addresses** (or restrict to your CF landscape)
5. **Map the instance to your Cloud Foundry Organization + Space** (required for HDI container binding)
6. Click **Create Instance** — provisioning takes ~10–15 minutes

> ⚠️ The `hana-free` plan auto-stops after 30 days of inactivity and must be manually restarted from SAP HANA Cloud Central.

> ℹ️ Once a HANA Cloud instance is mapped to your CF Space, the `hana` service with plan `hdi-shared` becomes available for HDI container creation during MTA deployment.

### 2.3 CDS Configuration

The project uses HANA Cloud in production and SQLite locally. This is configured in `.cdsrc.json`:

```json
{
  "requires": {
    "db": {
      "[development]": { "kind": "sqlite", "credentials": { "url": "db.sqlite" } },
      "[production]": { "kind": "hana", "deploy-format": "hdbtable" }
    }
  }
}
```

The `@cap-js/hana` package (in `package.json` dependencies) provides the HANA Cloud CDS plugin.

---

## Step 3: Build the MTA Archive

```bash
mbt build -t gen --mtar find-my-expert.mtar
```

What happens:
- Runs `npm ci` + `npx cds build --production`
- Generates HANA-compatible DB artifacts in `gen/db`
- Builds each UI5 app into a `.zip`
- Packages everything into `gen/find-my-expert.mtar`

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

> **First deployment with old portal service?** If you previously deployed with the `find-my-expert-portal-service` resource and `find-my-expert-flp-content` module, use `--delete-services` to clean up orphaned services:
> ```bash
> cf deploy gen/find-my-expert.mtar --delete-services
> ```

### Deployment Modules

| Module | Type | What it does |
|--------|------|-------------|
| `find-my-expert-srv` | Node.js | CAP backend |
| `find-my-expert-db-deployer` | hdb | HDI container schema deployment (automatic) |
| `findmyexpert-search` etc. | HTML5 | Builds UI5 apps |
| `find-my-expert-app-content` | Content deployer | Uploads UI5 zips to HTML5 Repo |
| `find-my-expert-destinations` | Content deployer | Creates destinations in Destination Service |

### Service Instances Created

| Resource | Service | Plan |
|----------|---------|------|
| `find-my-expert-auth` | xsuaa | application |
| `find-my-expert-db` | hana | hdi-shared |
| `find-my-expert-repo-host` | html5-apps-repo | app-host |
| `find-my-expert-repo-runtime` | html5-apps-repo | app-runtime |
| `find-my-expert-destination-service` | destination | lite |

> **No standalone AppRouter CF app** — Work Zone Standard Edition uses a managed AppRouter automatically.

> **No launchpad content module** — SAP has blocked `content_endpoint` for Build Work Zone Standard Edition. The `flp/cdm.json` CDM descriptor cannot be deployed via MTA. Apps must be configured manually in Work Zone Site Manager (see Step 7).

---

## Step 6: Assign Role Collections

In **BTP Cockpit → Security → Role Collections**, assign to users:

| Role Collection | Access |
|----------------|--------|
| `FindMyExpert_Viewer` | Expert Search (read-only) |
| `FindMyExpert_Admin` | Full CRUD: Experts, Roles, Topics + Search |

---

## Step 7: Work Zone Setup (Manual FLP Configuration)

Since launchpad content deployment via MTA is no longer supported for Build Work Zone Standard Edition, you must configure the FLP tiles and groups manually in **Work Zone Site Manager**.

### 7.1 Open Work Zone Site Manager

1. **BTP Cockpit → Services → Instances and Subscriptions**
2. Click on **SAP Build Work Zone, standard edition** → **Go to Application**

### 7.2 Fetch Updated Content (Channel Manager)

1. In Work Zone Admin → **Channel Manager** (left sidebar)
2. Find the **HTML5 Apps** content provider
3. Click the **refresh/fetch** icon → **Fetch updated content**
4. Wait until status shows **Updated**

This pulls in all 4 apps deployed to the HTML5 Application Repository.

### 7.3 Add Apps to Content (Content Manager)

1. **Content Manager → Content Explorer**
2. Click on **HTML5 Apps**
3. Select all 4 apps and click **Add to My Content**:

| App ID | Title | Inbound Navigation |
|--------|-------|--------------------|
| `findmyexpertSearch` | Expert Search | `findmyexpert-search` |
| `findmyexpert.findmyexpertmanageexperts` | Manage Experts | `Expert-manage` |
| `findmyexpert.findmyexpertmanageroles` | Manage Roles | `findmyexpert-ManageRoles-inbound` |
| `findmyexpert.findmyexpertmanagetopics` | Manage Topics | `ManageTopics-display` |

### 7.4 Create a Group

1. **Content Manager → My Content → + New → Group**
2. Title: **Find My Expert**
3. Assign all 4 apps to this group
4. **Save**

### 7.5 Assign Apps to Roles

1. **Content Manager → My Content → Items tab**
2. Open the **Everyone** role → **Edit** → assign **Expert Search** → **Save**
   (This makes Expert Search visible to all authenticated users)
3. Create a new role or edit an existing role for admins:
   - Title: **FindMyExpert Admin**
   - Assign all 4 apps
   - **Save**

> **Role mapping:** The Work Zone roles control which tiles are visible. The actual data access is controlled by XSUAA role collections (`FindMyExpert_Viewer`, `FindMyExpert_Admin`) assigned in BTP Cockpit.

### 7.6 Create or Open a Site

1. **Site Directory → + Create Site**
2. Name: e.g. **"SAP Austria Portal"**
3. Open the site — apps appear as tiles in the Launchpad based on role assignments

### 7.7 Verify App Navigation

Each app's semantic object and action (for cross-app navigation):

| App | Semantic Object | Action |
|-----|----------------|--------|
| Expert Search | `findmyexpert` | `search` |
| Manage Experts | `Expert` | `manage` |
| Manage Roles | `findmyexpert-ManageRoles` | `inbound` |
| Manage Topics | `ManageTopics` | `display` |

---

## Accessing the SAP HANA Database

After deployment, an **HDI container** is created and bound to the `find-my-expert-srv` and `find-my-expert-db-deployer` modules.

### Option 1: SAP HANA Database Explorer (Browser)

1. **BTP Cockpit → Instances and Subscriptions** → click **SAP HANA Cloud** (`tools`) → **Open Application**
2. In SAP HANA Cloud Central, locate your HANA instance → click **Actions (⋮) → Open in SAP HANA Database Explorer**
3. Add the HDI container as a database connection to browse tables and run SQL

#### HDI Container Table Names

| CDS Entity | HDI Container Table |
|---|---|
| `findmyexpert.Experts` | `FINDMYEXPERT_EXPERTS` |
| `findmyexpert.Topics` | `FINDMYEXPERT_TOPICS` |
| `findmyexpert.Solutions` | `FINDMYEXPERT_SOLUTIONS` |
| `findmyexpert.ExpertRoles` | `FINDMYEXPERT_EXPERTROLES` |
| `findmyexpert.ExpertLanguages` | `FINDMYEXPERT_EXPERTLANGUAGES` |
| `findmyexpert.Roles` | `FINDMYEXPERT_ROLES` |

> ⚠️ HANA table names are **uppercase** by default.

### Option 2: CF Service Key (Credentials)

```bash
# Create a service key for the HDI container
cf create-service-key find-my-expert-db hdi-access-key

# View the credentials
cf service-key find-my-expert-db hdi-access-key
```

### Option 3: Local Hybrid Testing (`cds bind`)

```bash
# Bind local project to deployed HDI container
cds bind -2 find-my-expert-db
cds bind -2 find-my-expert-auth

# Start local server connected to cloud HANA
cds watch --profile hybrid
```

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

| Service | Plan | Estimated Cost |
|---------|------|---------------|
| HANA Cloud | `hana-free` (30 GB) | Free (auto-stops after 30 days inactivity) |
| HANA Cloud | `hana` (production) | ~€400–1,500+/month (depends on memory/storage) |
| HDI Container | `hdi-shared` | Free (included with HANA Cloud) |
| XSUAA | `application` | Free |
| HTML5 Repo | `app-host` | Free (included) |
| Destination Service | `lite` | Free |
| Work Zone | `standard` | Included in BTP license |

> **Tip:** Use `hana-free` for development/testing. Switch to a production-sized instance for go-live.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| **403 Forbidden** | Check role collection assignments in BTP Cockpit |
| **404 Not Found** | Verify HTML5 repo: `cf html5-list -di find-my-expert-repo-host -u` |
| **Apps not visible in Work Zone** | Channel Manager → Fetch updated content; Content Manager → Add to My Content |
| **502 Bad Gateway** | Check srv logs: `cf logs find-my-expert-srv --recent` |
| **HANA connection error** | Verify HDI container binding: `cf services`; check if HANA instance is running in BTP Cockpit |
| **HANA deployer failed** | Ensure `@cap-js/hana` is in dependencies and HANA instance is mapped to CF space |
| **No HANA instance found** | Provision SAP HANA Cloud instance and map to CF org/space first |
| **`content_endpoint` blocked** | This is expected — SAP no longer supports launchpad content deployment for Build Work Zone. Configure apps manually in Site Manager (Step 7) |
| **Old portal service still exists** | Redeploy with `cf deploy ... --delete-services` to remove orphaned `build-workzone-standard` service |
| **HTML5 repo upload fails** | Check `ui5.yaml` has correct build config; verify `npx ui5 build` works locally in each app dir |
| **Joule destination not visible** | Add `sap.processautomation.enabled = true` to destination additional properties |
| **Joule action not in Skill Builder** | Action must be **Published to Library**, not just Released |

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

# Clean deploy (removes orphaned services from previous MTA versions)
cf deploy gen/find-my-expert.mtar --delete-services