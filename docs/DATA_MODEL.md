# Data Model

CDS schema and entity relationships for **Find My Expert**.

---

## Entity Relationship Diagram

```
┌──────────────┐         ┌───────────────────┐         ┌───────────────┐
│   Topics     │ 1 ──< n │    Solutions       │ 1 ──< n │  ExpertRoles  │
│──────────────│         │───────────────────│         │───────────────│
│ ID: String   │         │ ID: String        │         │ ID: String    │
│ name         │         │ name              │         │ expert →      │
│ description  │         │ description       │         │ solution →    │
│ solutions →  │         │ topic →           │         │ role (enum)   │
└──────────────┘         │ experts →         │         │ canPresent5M  │
                         └───────────────────┘         │ canPresent30M │
                                                        │ canPresent2H  │
┌──────────────────┐                                   │ canPresentDemo│
│   Experts        │ 1 ──< n ──────────────────────────│ notes         │
│──────────────────│                                   └───────────────┘
│ ID: String       │
│ firstName        │
│ lastName         │
│ email            │
│ location         │
│ roles →          │
└──────────────────┘
```

---

## Entities

### `Topics`

Master data for SAP topic areas.

| Field | Type | Description |
|---|---|---|
| `ID` | `String(50)` | Primary key (e.g. `t-ai`, `t-btp`) |
| `name` | `String(100)` | Display name (e.g. "AI", "BTP") |
| `description` | `String(500)` | Short description |
| `solutions` | Association | → Solutions (1:n) |
| *(managed)* | | `createdAt`, `createdBy`, `modifiedAt`, `modifiedBy` |

**Current Topics:**

| ID | Name | Description |
|---|---|---|
| `t-ai` | AI | Artificial Intelligence & Joule |
| `t-bdc` | BDC | Business Data Cloud — Datasphere Analytics |
| `t-btp` | BTP | Business Technology Platform |
| `t-erp` | CloudERP | Cloud ERP & S/4HANA |
| `t-hcm` | HCM | Human Capital Management — SuccessFactors |
| `t-itc` | Integrated Toolchain | Signavio, LeanIX, WalkMe, CALM, Tricentis |
| `t-rise` | RISE | RISE with SAP |
| `t-ti` | T&I | Technology & Innovation |

---

### `Solutions`

SAP products and services within a topic.

| Field | Type | Description |
|---|---|---|
| `ID` | `String(50)` | Primary key (e.g. `s-ai-joule`) |
| `name` | `String(200)` | Display name |
| `description` | `String(1000)` | Optional description |
| `topic` | Association | → Topics (n:1) |
| `experts` | Association | → ExpertRoles (1:n) |

---

### `Experts`

People — internal SAP employees.

| Field | Type | Description |
|---|---|---|
| `ID` | `String(50)` | Primary key (e.g. `e-001`) |
| `firstName` | `String(100)` | First name |
| `lastName` | `String(100)` | Last name |
| `email` | `String(200)` | SAP email address |
| `location` | `String(10)` | Location code: `AT`, `DE`, `CH` |
| `roles` | Association | → ExpertRoles (1:n) |

---

### `ExpertRoles`

Junction table — connects Experts to Solutions with role and capability metadata.

| Field | Type | Description |
|---|---|---|
| `ID` | `String(50)` | Primary key |
| `expert` | Association | → Experts (n:1) |
| `solution` | Association | → Solutions (n:1) |
| `role` | `ExpertRoleType` | Role enum (see below) |
| `canPresent5M` | `Boolean` | Can give 5-minute presentation |
| `canPresent30M` | `Boolean` | Can give 30-minute presentation |
| `canPresent2H` | `Boolean` | Can give 2-hour workshop |
| `canPresentDemo` | `Boolean` | Can give live demo |
| `notes` | `String(500)` | Free-text notes |

---

### `ExpertRoleType` Enum

Ordered by relevance weight (used in `searchExperts` scoring):

| Enum Value | Label | Weight |
|---|---|---|
| `TOPIC_OWNER` | Topic Owner | 100 |
| `SOLUTIONING_ARCH` | Solutioning Architect | 85 |
| `THEMEN_LEAD` | Themen Lead | 75 |
| `SERVICE_SELLER` | Service Seller | 65 |
| `REALIZATION_LEAD` | Realization Lead | 55 |
| `REALIZATION_CONSULTANT` | Realization Consultant | 45 |
| `PROJECT_MANAGEMENT` | Project Management | 35 |
| `OTHER_CONTACT_AT` | Other Contact (AT) | 20 |
| `OTHER_CONTACT_NON_AT` | Other Contact | 10 |

---

## Key CDS Features Used

- **`managed` aspect** — auto-sets `createdAt`, `createdBy`, `modifiedAt`, `modifiedBy`
- **`@assert.range`** — validates `role` field against enum values at DB level
- **String(50) keys** — human-readable short IDs instead of UUIDs (e.g. `e-001`, `t-ai`)

> **Why not UUID?**  
> Short IDs like `e-001` are intentional for readability in URLs, logs, and seed data.
> CAP's `cuid` generates UUIDs which are incompatible with these short IDs.
> The schema uses `String(50)` keys with manual ID management.

---

## Associations & Navigation

CAP OData V4 supports deep `$expand`:

```
GET /api/catalog/Experts('e-001')?$expand=roles($expand=solution($expand=topic))
```

Returns an expert with all their roles, each with solution and topic data.

```
GET /api/catalog/Experts?$expand=roles($expand=solution($expand=topic))&$orderby=lastName,firstName
```

Used by ExpertList view for the expert table.
