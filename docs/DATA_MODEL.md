# Data Model

CDS schema and entity relationships for **Find My Expert**.

---

## Entity Relationship Diagram

```
┌──────────────┐         ┌───────────────────┐         ┌───────────────────┐
│   Topics     │ 1 ──< n │    Solutions       │ 1 ──< n │   ExpertRoles     │
│──────────────│         │───────────────────│         │───────────────────│
│ ID: UUID     │         │ ID: UUID          │         │ ID: UUID          │
│ name         │         │ name              │         │ expert →          │
│ description  │         │ description       │         │ solution →        │
│ solutions ↓  │         │ topic →           │         │ role →            │
└──────────────┘         │ experts ↓         │         │ canPresent5M      │
                         └───────────────────┘         │ canPresent30M     │
                                                        │ canPresent2H      │
┌──────────────────┐                                    │ canPresentDemo    │
│   Experts        │ 1 ──< n ──────────────────────────▶│ notes             │
│──────────────────│                                    └───────────────────┘
│ ID: UUID         │
│ firstName        │     ┌───────────────────┐
│ lastName         │     │  ExpertLanguages  │
│ email            │     │───────────────────│
│ country →        │     │ ID: UUID          │
│ roles ↓          │     │ expert →          │
│ languages ↓      │─────▶│ language →       │
└──────────────────┘     └───────────────────┘

┌──────────────┐
│   Roles      │◀──────── ExpertRoles.role
│──────────────│
│ ID: UUID     │
│ name         │
│ priority     │
│ description  │
└──────────────┘
```

---

## Entities

### `Topics`

Master data for SAP topic areas.

| Field | Type | Description |
|-------|------|-------------|
| `ID` | UUID (`cuid`) | Primary key |
| `name` | `String(100)` | Display name (e.g. "AI", "BTP") |
| `description` | `String(500)` | Short description |
| `solutions` | Composition | → Solutions (1:n) |
| *(managed)* | | `createdAt`, `createdBy`, `modifiedAt`, `modifiedBy` |

**Current Topics (seed data):**

| Name | Description |
|------|-------------|
| AI | Artificial Intelligence & Joule |
| BDC | Business Data Cloud — Datasphere & Analytics |
| BTP | Business Technology Platform |
| CloudERP | Cloud ERP & S/4HANA |
| HCM | Human Capital Management — SuccessFactors |
| Integrated Toolchain | Signavio, LeanIX, WalkMe, CALM, Tricentis |
| RISE | RISE with SAP |
| T&I | Technology & Innovation |

---

### `Solutions`

SAP products and services within a topic.

| Field | Type | Description |
|-------|------|-------------|
| `ID` | UUID (`cuid`) | Primary key |
| `name` | `String(200)` | Display name |
| `description` | `String(1000)` | Optional description |
| `topic` | Association | → Topics (n:1) |
| `experts` | Composition | → ExpertRoles (1:n) |

44 solutions in seed data across all 8 topics.

---

### `Experts`

People — internal SAP Austria employees.

| Field | Type | GDPR | Description |
|-------|------|------|-------------|
| `ID` | UUID (`cuid`) | — | Primary key |
| `firstName` | `String(100)` | `GivenName` | First name |
| `lastName` | `String(100)` | `FamilyName` | Last name |
| `email` | `String(200)` | `EMail` | SAP email (validated format) |
| `country` | Association → `sap.common.Countries` | `IsPotentiallyPersonal` | ISO 3166 country |
| `languages` | Composition | — | → ExpertLanguages (1:n) |
| `roles` | Composition | — | → ExpertRoles (1:n) |
| `languagesText` | virtual `String(200)` | — | Language codes joined by ` · ` (computed) |
| *(managed)* | | | `createdAt`, `createdBy`, `modifiedAt`, `modifiedBy` |

**GDPR annotations on entity:**
```cds
@PersonalData.EntitySemantics: 'DataSubject'
```

---

### `Roles`

Admin-manageable role types. The `priority` field drives relevance ranking in `searchExperts`.

| Field | Type | Description |
|-------|------|-------------|
| `ID` | UUID (`cuid`) | Primary key |
| `name` | `String(100)` | Display name |
| `priority` | Integer | Relevance weight — higher = shown first |
| `description` | `String(500)` | Optional description |

**Default seed data (priority values):**

| Role Name | Priority |
|-----------|----------|
| Topic Owner / SPOC | 50 |
| Themen Lead | 45 |
| Solutioning / Architecture / Advisory | 40 |
| Realization Lead | 35 |
| Project Management | 30 |
| Realization Consultant | 25 |
| Service Seller | 20 |
| Other Contact (AT) | 10 |
| Other Contact (non-AT) | 5 |

> Priorities are admin-configurable in the Manage Roles app.

---

### `ExpertRoles`

Junction table — connects Experts to Solutions with role and capability metadata.

| Field | Type | Description |
|-------|------|-------------|
| `ID` | UUID (`cuid`) | Primary key |
| `expert` | Association | → Experts (n:1) |
| `solution` | Association | → Solutions (n:1) |
| `role` | Association | → Roles (n:1) |
| `canPresent5M` | Boolean | Can give 5-minute presentation |
| `canPresent30M` | Boolean | Can give 30-minute presentation |
| `canPresent2H` | Boolean | Can give 2-hour workshop |
| `canPresentDemo` | Boolean | Can give live demo |
| `notes` | `String(500)` | Free-text notes |
| `relevanceScore` | virtual Integer | Computed: `role.priority` + capability bonuses |

**Unique constraint:** one expert can only have one role per solution  
(enforced server-side in `catalog-service.js`, HTTP 409 on duplicate).

85 role assignments in seed data (20 experts × ~4 assignments each).

---

### `ExpertLanguages`

Junction table — connects Experts to spoken languages.

| Field | Type | Description |
|-------|------|-------------|
| `ID` | UUID (`cuid`) | Primary key |
| `expert` | Association | → Experts (n:1) |
| `language` | Association | → `sap.common.Languages` (n:1) |

Uses SAP's standard language list (23 languages from `@sap/cds-common-content`).

---

## Derived View: `ExpertSearch`

Not a separate DB table — a CDS view defined in `srv/catalog-service.cds`.  
Joins ExpertRoles → Experts → Solutions → Topics into a flat denormalized structure  
for the Search & Browse Fiori app.

Aggregated server-side in `catalog-service.js`:
- One result per expert (deduplication across multiple solution assignments)
- `solutionName`, `topicName`, `roleName` → comma-separated strings
- `relevanceScore` → max score across all roles
- `canPresent*` flags → OR across all roles
- `languagesText` → loaded from ExpertLanguages and joined

---

## Key CDS Features Used

| Feature | Usage |
|---------|-------|
| `cuid` aspect | Auto-generates UUIDs for all primary keys |
| `managed` aspect | Auto-sets `createdAt`, `createdBy`, `modifiedAt`, `modifiedBy` |
| `sap.common.Countries` | Value help: 245 ISO 3166 countries (from `@sap/cds-common-content`) |
| `sap.common.Languages` | Value help: 23 SAP standard languages |
| `@PersonalData.*` | GDPR annotations — used by `@cap-js/audit-logging` |
| `@cds.search` | Enables `$search` queries on specified fields |
| `@cds.odata.valuelist` | Enables value help in Fiori forms |
| `odata.draft.enabled` | Draft workflow for admin CRUD entities |
