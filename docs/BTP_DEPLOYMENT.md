# BTP Deployment Guide — Find My Expert

## Prerequisites

### SAP BTP Account
- Active SAP BTP Cloud Foundry environment
- Sufficient quota for the required services

### Required BTP Services

| Service | Plan | Purpose |
|---------|------|---------|
| SAP HANA Cloud | `hdi-shared` | Database |
| SAP Authorization & Trust Management (XSUAA) | `application` | Authentication & authorization |
| HTML5 Application Repository | `app-host` + `app-runtime` | UI hosting |
| SAP Build Work Zone, standard edition | `standard` | Fiori Launchpad / Portal |

### Required Tools

```bash
# Cloud Foundry CLI
cf --version

# MultiApps CF CLI Plugin
cf install-plugin multiapps

# MTA Build Tool
npm install -g mbt
mbt --version
```

---

## Project Structure for Deployment

```
find-my-expert/
├── app/
│   ├── findmyexpert-search/          # Expert Search app
│   ├── findmyexpert-manage-experts/  # Manage Experts app
│   ├── findmyexpert-manage-roles/    # Manage Roles app
│   ├── findmyexpert-manage-topics/   # Manage Topics app
│   ├── router/                       # Approuter
│   └── appconfig/                    # FLP sandbox config (dev only)
├── flp/                              # Work Zone CDM content
│   └── cdm.json                      # Apps, catalogs, groups for Launchpad
├── srv/                              # CAP backend service
├── db/                               # Database artifacts
├── mta.yaml                          # MTA deployment descriptor
├── xs-security.json                  # XSUAA security config
└── package.json
```

---

## Step 1: Build the MTA Archive

```bash
mbt build -t gen --mtar find-my-expert.mtar
```

This will:
- Run `npm ci` and `npx cds build --production`
- Build each UI5 app into a zip archive
- Package everything into `gen/find-my-expert.mtar`

---

## Step 2: Login to Cloud Foundry

```bash
cf login -a https://api.cf.<region>.hana.ondemand.com
# Select org and space when prompted
```

---

## Step 3: Deploy to Cloud Foundry

```bash
cf deploy gen/find-my-expert.mtar
```

This deploys all modules:
- `find-my-expert-srv` — CAP backend (Node.js)
- `find-my-expert-db-deployer` — HDI container deployer
- `find-my-expert-router` — Approuter
- `findmyexpert-search`, `findmyexpert-manage-experts`, etc. — HTML5 apps → HTML5 repo
- `find-my-expert-app-content` — Deploys UI5 zips to HTML5 App Repository
- `find-my-expert-flp-content` — Deploys CDM content to Work Zone portal service

---

## Step 4: Assign Role Collections

After deployment, assign role collections to users in the **BTP Cockpit**:

**BTP Cockpit → Security → Role Collections**

| Role Collection | Contains Role | Purpose |
|----------------|---------------|---------|
| `FindMyExpert_Viewer` | `ExpertViewer` | Read access to expert directory |
| `FindMyExpert_Admin` | `Admin` + `ExpertViewer` | Full CRUD access |

Assign these to individual users or user groups/IdP groups.

---

## Step 5: SAP Build Work Zone Setup

### 5.1 Subscribe to Work Zone

1. **BTP Cockpit → Services → Instances and Subscriptions**
2. Subscribe to **SAP Build Work Zone, standard edition**
3. Assign the `Launchpad_Admin` role collection to yourself

### 5.2 Open Work Zone Admin

1. Click on **SAP Build Work Zone** subscription link
2. This opens the admin UI (Site Manager)

### 5.3 Update Content (Channel Manager)

1. Go to **Channel Manager** (left sidebar)
2. Find the **HTML5 Apps** content provider
3. Click **"Fetch updated content"** (refresh icon)
4. This pulls in the apps deployed via `find-my-expert-flp-content` and `find-my-expert-app-content`

### 5.4 Verify Content (Content Manager)

1. Go to **Content Manager** → **Content Explorer**
2. Click on the **HTML5 Apps** content provider
3. You should see all 4 apps:
   - **Expert Search** (`findmyexpert.search`)
   - **Manage Experts** (`findmyexpertManageExperts`)
   - **Manage Roles** (`findmyexpertManageRoles`)
   - **Manage Topics** (`findmyexpertManageTopics`)
4. Select all apps and click **"Add to My Content"**

### 5.5 Configure Roles in Content Manager

1. Go to **Content Manager → My Content**
2. Open the **Everyone** role (or create a custom role)
3. Click **Edit → Assign Items**
4. Assign the apps that should be visible to the respective role:
   - `Everyone` role → **Expert Search** (read-only app)
   - Custom `FindMyExpert_Admin` role → All 4 apps

### 5.6 Verify Group

The CDM deployment creates a group **"Find My Expert"** automatically.
If needed, manually adjust in **Content Manager → My Content → Groups**.

### 5.7 Create or Configure a Site

1. Go to **Site Directory**
2. Click **"Create Site"** (or edit an existing one)
3. Enter a name, e.g. **"SAP Austria Portal"**
4. Open the site → The apps appear as tiles on the Launchpad

---

## Step 6: Joule Skill Setup (Optional)

### Prerequisites
- SAP BTP subaccount with **Joule** entitlement (Joule Studio)
- Find My Expert backend deployed and accessible (Steps 1–4 completed)

### 6.1 Create BTP Destination

In **BTP Cockpit → Connectivity → Destinations**, create:

| Property | Value |
|----------|-------|
| **Name** | `FINDMYEXPERT_BACKEND` |
| **Type** | `HTTP` |
| **URL** | `https://<find-my-expert-srv-url>/api/catalog` |
| **Proxy Type** | `Internet` |
| **Authentication** | `OAuth2UserTokenExchange` |
| **Token Service URL** | `https://<xsuaa-url>/oauth/token` |
| **Client ID** | from XSUAA service key |
| **Client Secret** | from XSUAA service key |

> To get the srv URL: `cf app find-my-expert-srv | grep routes`
> To create a service key: `cf create-service-key find-my-expert-auth dest-key` then `cf service-key find-my-expert-auth dest-key`

### 6.2 Import Skill in Joule Studio

1. Open **Joule Studio** in your BTP subaccount
2. Go to **Skill Builder → Create New Skill**
3. Import `docs/joule-skill/skill-definition.json`
4. Configure the destination binding to `FINDMYEXPERT_BACKEND`

### 6.3 Test the Skill

Use the **Test/Playground** panel in Joule Studio:

```
"Find me an expert for BTP"
"Who can present about AI?"
"Show all topics"
"Who is the expert for S/4HANA Finance?"
"Find a German-speaking expert for SAP Integration Suite"
```

### 6.4 Publish the Skill

1. Click **Publish** in Joule Studio
2. The skill becomes available to all authorized users
3. Users access it via the **Joule side-panel** in Work Zone

### Skill Intents

| Intent | Description | Example |
|--------|-------------|---------|
| `findExpert` | Search experts by topic, solution, role, location | "Find an expert for BTP in Vienna" |
| `expertDetails` | Get details about a specific expert | "Tell me more about Max Mustermann" |
| `listTopics` | List all available expertise topics | "What topics are available?" |

---

## Troubleshooting

### Common Issues

| Problem | Solution |
|---------|----------|
| **403 Forbidden** | Check role collection assignments in BTP Cockpit |
| **404 Not Found** | Verify HTML5 repo deployment: `cf html5-list -di find-my-expert-repo-host -u` |
| **Apps not visible in Work Zone** | Channel Manager → Fetch updated content; Content Manager → Add to My Content |
| **502 Bad Gateway** | Check srv module logs: `cf logs find-my-expert-srv --recent` |
| **HANA connection error** | Ensure HDI container is bound: `cf services` |
| **Joule skill not responding** | Verify destination is reachable, check Joule Studio logs |

### Useful Commands

```bash
# Check deployed apps and their status
cf apps

# Check services
cf services

# View server logs
cf logs find-my-expert-srv --recent

# List HTML5 apps in the repository
cf html5-list -di find-my-expert-repo-host -u

# Check approuter logs
cf logs find-my-expert-router --recent

# Restage after config change
cf restage find-my-expert-srv

# Get srv URL for destination config
cf app find-my-expert-srv | grep routes
```

---

## Architecture (Deployed)

```
┌─────────────────────────────────────────────────────┐
│                SAP Build Work Zone                   │
│  ┌──────────┐ ┌──────────┐ ┌──────┐ ┌──────────┐   │
│  │  Expert   │ │  Manage  │ │Manage│ │  Manage  │   │
│  │  Search   │ │ Experts  │ │Roles │ │  Topics  │   │
│  └────┬─────┘ └────┬─────┘ └──┬───┘ └────┬─────┘   │
│       └─────────────┼─────────┼──────────┘          │
│                     │   Approuter                    │
│                     ▼                                │
│  ┌──────────────────────────────┐                    │
│  │      HTML5 App Repository    │                    │
│  └──────────────────────────────┘                    │
└─────────────────────┬───────────────────────────────┘
                      │ OData V4
                      ▼
          ┌───────────────────────┐
          │   CAP Backend (srv)   │
          │   /api/catalog        │◄──── Joule Skill
          └───────────┬───────────┘      (via Destination)
                      │
                      ▼
          ┌───────────────────────┐
          │   SAP HANA Cloud      │
          │   (HDI Container)     │
          └───────────────────────┘