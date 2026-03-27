# Find My Expert 🔍

**Internal SAP Austria Expert Directory — powered by SAP CAP + SAPUI5 Fiori**

Find My Expert is a Fiori application that allows SAP Austria employees to find the right internal expert for any SAP topic, solution, or technology. It supports full-text search with relevance scoring, a browseable expert directory, and admin tooling for maintaining master data.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔍 **Expert Search** | Full-text search across topics, solutions, names, and roles with relevance scoring |
| 👥 **Expert Directory** | Browseable list of all experts with filters (topic, location, name) |
| 👤 **Expert Detail** | Per-expert view with all roles, solutions, and presentation capabilities |
| ⚙️ **Admin: Topics & Solutions** | CRUD management for the topic/solution master data |
| 🧑‍💼 **Admin: Expert Management** | Create, edit, and assign experts to solutions and roles |
| 🔐 **XSUAA Role-Based Access** | `Admin` and `Viewer` roles via BTP role collections |
| 🧪 **Dev Mode** | Automatic Admin access — no login needed locally |

---

## 🏗️ Architecture

```
find-my-expert/
├── app/
│   └── findmyexpert/          # SAPUI5 Fiori App
│       ├── webapp/
│       │   ├── controller/    # MVC Controllers
│       │   ├── view/          # XML Views
│       │   ├── i18n/          # DE/EN translations
│       │   ├── css/           # Custom styles
│       │   ├── Component.js   # App bootstrap + auth
│       │   ├── manifest.json  # App descriptor
│       │   ├── index.html     # Standalone entry
│       │   └── sandbox.html   # FLP Launchpad sandbox
│       ├── ui5.yaml           # UI5 Tooling config
│       └── xs-app.json        # AppRouter routes (BTP)
├── db/
│   ├── schema.cds             # CDS data model
│   └── data/                  # CSV seed data
├── srv/
│   ├── catalog-service.cds    # Public read + searchExperts
│   ├── catalog-service.js     # searchExperts implementation
│   ├── admin-service.cds      # Admin CRUD (requires Admin role)
│   └── admin-service.js       # Validation handlers
├── .cdsrc.json                # DEV config (mocked auth, SQLite)
├── package.json               # Root dependencies + cds config
├── xs-security.json           # XSUAA security descriptor
└── docs/                      # Documentation
```

**Tech Stack:**
- **Backend:** SAP CAP Node.js (`@sap/cds` 9.x)
- **Database:** SQLite (dev) / SAP HANA or PostgreSQL (prod)
- **Frontend:** SAPUI5 1.132.1, Fiori Horizon Theme
- **Auth:** CAP Mocked Auth (dev) / XSUAA (prod)
- **Deploy Target:** SAP BTP Cloud Foundry / SAP Build Work Zone

---

## 🚀 Quick Start (DEV)

```bash
git clone https://github.com/LINZO-AT/find-my-expert.git
cd find-my-expert
npm install
npm start
```

Open: **http://localhost:4004/findmyexpert/webapp/index.html**

> In DEV mode, you are automatically logged in as **Admin** — no credentials required.

FLP Sandbox: **http://localhost:4004/findmyexpert/webapp/sandbox.html**

→ See [DEV Setup Guide](docs/DEV_SETUP.md) for details.

---

## 🔐 Authentication

| Environment | Auth Provider | Admin Access |
|---|---|---|
| **DEV** | CAP Mocked Auth | Automatic — all users = Admin |
| **PROD** | SAP XSUAA (BTP) | Role Collection `FindMyExpert_Admin` |

Role Collections (assign in BTP Cockpit):

| Role Collection | Access |
|---|---|
| `FindMyExpert_Admin` | Full access: search, view, manage all data |
| `FindMyExpert_Viewer` | Read-only: search and browse experts |

→ See [BTP Deployment Guide](docs/BTP_DEPLOYMENT.md) for XSUAA setup.

---

## 📚 Documentation

| Document | Description |
|---|---|
| [DEV Setup](docs/DEV_SETUP.md) | Local development setup |
| [BTP Deployment](docs/BTP_DEPLOYMENT.md) | Deploy to SAP BTP Cloud Foundry |
| [Developer Guide](docs/DEVELOPER_GUIDE.md) | Architecture, coding standards, extension points |
| [Data Model](docs/DATA_MODEL.md) | CDS schema and entity relationships |
| [API Reference](docs/API_REFERENCE.md) | CAP OData services and searchExperts action |

---

## 📊 Data Model (Overview)

```
Topics ──< Solutions ──< ExpertRoles >── Experts
  AI           S/4HANA Finance      TOPIC_OWNER     Thomas H.
  BTP          Integration Suite    REALIZATION_LEAD Maria S.
  ...          ...                  ...             ...
```

---

## 🧑‍💻 Contributing

See [Developer Guide](docs/DEVELOPER_GUIDE.md).
