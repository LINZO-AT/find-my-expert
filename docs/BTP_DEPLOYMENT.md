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
               │   SAP HANA Cloud      │
               │   (HDI Container)     │
               └───────────────────────┘
```

---

## Prerequisites

### BTP Entitlements Required

| Service | Plan | Purpose |
|---------|------|---------|
| SAP HANA Cloud | `hdi-shared` | Database (HDI Container) |
| SAP Authorization & Trust Management (XSUAA) | `application` | Auth & authorization |
| HTML5 Application Repository | `app-host` + `app-runtime` | UI app hosting |
| **SAP Build Work Zone, standard edition** | `standard` | Launchpad shell + managed AppRouter |

> ⚠️ The service name in BTP is `SAPLaunchpad` with plan `standard` (Work Zone Standard Edition). Not `portal`.

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
├── db/                               # HANA DB schema + seed data
├── docs/                             # Documentation
├── mta.yaml                          # MTA deployment descriptor
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

## Step 2: Build the MTA Archive

```bash
mbt build -t gen --mtar find-my-expert.mtar
```

What happens:
- Runs `npm ci` + `npx cds build --production`
- Builds each UI5 app into a `.zip`
- Packages everything into `gen/find-my-expert.mtar`

---

## Step 3: Login to Cloud Foundry

```bash
cf login -a https://api.cf.<region>.hana.ondemand.com
# Select org and space
```

---

## Step 4: Deploy

```bash
cf deploy gen/find-my-expert.mtar
```

This deploys:

| Module | Type | What it does |
|--------|------|-------------|
| `find-my-expert-srv` | Node.js | CAP backend |
| `find-my-expert-db-deployer` | HDI | Database schema + seed data |
| `findmyexpert-search` etc. | HTML5 | Builds UI5 apps |
| `find-my-expert-app-content` | Content deployer | Uploads UI5 zips to HTML5 Repo |
| `find-my-expert-flp-content` | Content deployer | Deploys CDM to Work Zone |
| `find-my-expert-destinations` | Content deployer | Creates destinations in Work Zone |

> **No standalone AppRouter CF app** — Work Zone Standard Edition uses a managed AppRouter automatically.

---

## Step 5: Assign Role Collections

In **BTP Cockpit → Security → Role Collections**, assign to users:

| Role Collection | Access |
|----------------|--------|
| `FindMyExpert_Viewer` | Expert Search (read-only) |
| `FindMyExpert_Admin` | Full CRUD: Experts, Roles, Topics + Search |

---

## Step 6: Work Zone Setup (Post-Deploy)

### 6.1 Open Work Zone Site Manager

1. **BTP Cockpit → Services → Instances and Subscriptions**
2. Click on **SAP Build Work Zone, standard edition** → Open

### 6.2 Fetch Updated Content (Channel Manager)

1. In Work Zone Admin → **Channel Manager** (left sidebar)
2. Find the **HTML5 Apps** content provider
3. Click the **refresh/fetch** icon → **Fetch updated content**
4. Wait until status shows **Updated**

This pulls in all 4 apps deployed via the MTA.

### 6.3 Add Apps to Content (Content Manager)

1. **Content Manager → Content Explorer**
2. Click on **HTML5 Apps**
3. Select all 4 apps:
   - `findmyexpertSearch` — Expert Search
   - `findmyexpertManageExperts` — Manage Experts
   - `findmyexpertManageRoles` — Manage Roles
   - `findmyexpertManageTopics` — Manage Topics
4. Click **Add to My Content**

### 6.4 Assign Apps to Roles

1. **Content Manager → My Content → Roles**
2. Edit the **Everyone** role → assign **Expert Search** (visible to all authenticated users)
3. Create or edit a **FindMyExpert_Admin** role → assign all 4 apps
4. Map this role to the `FindMyExpert_Admin` role collection from BTP

> The CDM deployment (`flp/cdm.json`) also creates a **catalog** and **group** automatically. Check Content Manager → My Content to verify.

### 6.5 Open or Create a Site

1. **Site Directory → Create Site** (or open existing)
2. Name it e.g. **"SAP Austria Portal"**
3. Open the site — apps appear as tiles in the Launchpad

---

## Step 7: Joule Skill Setup

### Prerequisites
- BTP subaccount with **Joule** entitlement + **SAP Build Process Automation** (build-default plan)
- Joule Booster completed (Global Account → Boosters → "Setting Up Joule")
- Find My Expert backend deployed (Steps 1–5 above)

### 7.1 Create BTP Destination

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

### 7.2 Register Destination in SAP Build

1. **SAP Build Lobby → Control Tower → Destinations**
2. Click **Open in BTP Cockpit** — verify `FINDMYEXPERT_BACKEND` appears
3. **Control Tower → Environments → Create/select environment**
4. Add `FINDMYEXPERT_BACKEND` to the environment
5. Click **Check Connection** — confirm green checkmark

### 7.3 Create Action Project

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

### 7.4 Build the Joule Skill

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

### 7.5 Test in Joule

**SAP Build → Control Tower → Environments → your environment → Joule → Launch**

Example queries:
- `"Find me an expert for BTP Integration Suite"`
- `"Wer ist mein Experte für S/4HANA Finance?"`
- `"Who can present about AI in SAP?"`
- `"Find a German-speaking expert for Signavio"`

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| **403 Forbidden** | Check role collection assignments in BTP Cockpit |
| **404 Not Found** | Verify HTML5 repo: `cf html5-list -di find-my-expert-repo-host -u` |
| **Apps not visible in Work Zone** | Channel Manager → Fetch updated content; Content Manager → Add to My Content |
| **502 Bad Gateway** | Check srv logs: `cf logs find-my-expert-srv --recent` |
| **HANA connection error** | Verify HDI container binding: `cf services` |
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
```
