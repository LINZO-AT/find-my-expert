# API Reference

OData V4 services exposed by the **Find My Expert** CAP backend.

---

## Base URLs

| Environment | URL |
|---|---|
| DEV (local) | `http://localhost:4004` |
| Tailscale dev | `http://100.110.130.119:4004` |
| BTP CF | `https://<app>.cfapps.<region>.hana.ondemand.com` |

---

## Authentication

| Environment | Method |
|---|---|
| DEV | No auth required (anonymous = Admin via `.cdsrc.json`) |
| PROD | XSUAA JWT Bearer token (managed by AppRouter / SSO) |

---

## CatalogService — `/api/catalog/`

All entities and actions (including admin) are exposed under this single service path.  
Access is controlled by role annotations (`ExpertViewer`, `Admin`).

### Read-Only Entities

#### `GET /api/catalog/Topics`

```http
GET /api/catalog/Topics?$orderby=name
```

#### `GET /api/catalog/Solutions`

```http
GET /api/catalog/Solutions?$filter=topic_ID eq '<uuid>'&$orderby=name
```

#### `GET /api/catalog/Experts`

```http
GET /api/catalog/Experts?$expand=roles($expand=solution($expand=topic))&$orderby=lastName,firstName
```

#### `GET /api/catalog/ExpertSearch`

Denormalized flat view for the Search & Browse Fiori app. One row per expert,  
aggregated across all their solutions/topics/roles. Includes virtual `relevanceScore`.

```http
GET /api/catalog/ExpertSearch?$orderby=relevanceScore desc
GET /api/catalog/ExpertSearch?$search=Signavio
GET /api/catalog/ExpertSearch('<expertID>')
GET /api/catalog/ExpertSearch('<expertID>')?$expand=expertRoles
```

**Fields:**

| Field | Type | Description |
|---|---|---|
| `ID` | UUID | = expertID (primary key for this view) |
| `expertID` | UUID | Expert's ID |
| `firstName` / `lastName` | String | Expert name |
| `fullName` | String | `lastName firstName` (computed) |
| `email` | String | SAP email |
| `country_code` | String | ISO 3166 country code |
| `countryName` | String | Country display name |
| `solutionName` | String | Comma-separated solutions (aggregated) |
| `topicName` | String | Comma-separated topics (aggregated) |
| `roleName` | String | Comma-separated roles (aggregated) |
| `relevanceScore` | Integer | Computed from role priority + capabilities |
| `canPresent5M/30M/2H` | Boolean | Presentation capabilities (OR across all roles) |
| `canPresentDemo` | Boolean | Demo capability |
| `languagesText` | String | Language codes joined by ` · ` |
| `expertRoles` | Association | Navigable to ExpertRoles for Object Page detail |

---

### Functions

#### `GET /api/catalog/userInfo()`

Returns current user's auth state.

```http
GET /api/catalog/userInfo()
```

**Response:**

| Field | Type | Description |
|---|---|---|
| `isAdmin` | Boolean | `true` if user has Admin role |
| `userName` | String | User ID (email in PROD, "Dev/Admin" in DEV) |

```json
{ "isAdmin": true, "userName": "dev/admin" }
```

---

### Actions

#### `POST /api/catalog/searchExperts`

Keyword-based relevance search. Designed for Joule Skill integration — returns a  
flat result list optimized for natural language response generation.

```http
POST /api/catalog/searchExperts
Content-Type: application/json

{ "query": "Signavio" }
```

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | String | ✅ | Search terms (space-separated, case-insensitive) |

**Response — array of matched experts:**

| Field | Type | Description |
|-------|------|-------------|
| `expertID` | UUID | Expert's ID |
| `firstName` | String | First name |
| `lastName` | String | Last name |
| `email` | String | SAP email |
| `solutionName` | String | Comma-separated matching solutions |
| `topicName` | String | Comma-separated topics |
| `roleName` | String | Comma-separated roles |
| `score` | Integer | Relevance score (role priority + keyword match bonus) |
| `reasoning` | String | Plain text explanation (e.g. "Keyword match: signavio. Role score: 60.") |
| `canPresent5M/30M/2H` | Boolean | Presentation capabilities |
| `canPresentDemo` | Boolean | Demo capability |
| `isMockMode` | Boolean | `true` — keyword mode indicator (remove once ranking is final) |

**Scoring algorithm (current — keyword-based):**

Base score = `role.priority` (admin-configurable, see Roles entity).  
Bonus: `+5` per matched keyword token.  
Capability bonuses: `canPresent2H +3`, `canPresentDemo +2`, `canPresent30M +1`, `canPresent5M +1`.

Results sorted by score descending, then lastName ascending as tiebreaker.  
Experts with zero keyword matches are excluded.

```json
[
  {
    "expertID": "3f2a...",
    "firstName": "Max",
    "lastName": "Mustermann",
    "email": "max.mustermann@sap.com",
    "solutionName": "Signavio",
    "topicName": "Integrated Toolchain",
    "roleName": "Topic Owner",
    "score": 65,
    "reasoning": "Keyword match: signavio. Role score: 65.",
    "canPresent5M": true,
    "canPresent30M": true,
    "canPresent2H": false,
    "canPresentDemo": true,
    "isMockMode": true
  }
]
```

---

### Admin Entities (require `Admin` role)

All under `/api/catalog/` — not a separate service path.

| Entity | Draft | Description |
|--------|-------|-------------|
| `AdminExperts` | ✅ | Full CRUD for experts |
| `AdminExpertRoles` | — | Sub-table: expert ↔ solution ↔ role |
| `AdminExpertLanguages` | — | Sub-table: expert ↔ language |
| `AdminTopics` | ✅ | Topics master data |
| `AdminSolutions` | — | Solutions master data (under AdminTopics) |
| `AdminRoles` | ✅ | Roles master data (with priority) |

Standard OData V4 query options apply: `$filter`, `$expand`, `$orderby`, `$top`, `$skip`, `$select`.

**Validation (server-side):**

| Rule | Entity | Detail |
|------|--------|--------|
| Email format | `AdminExperts` | Regex validation on CREATE/UPDATE |
| No duplicate role assignments | `AdminExpertRoles` | Unique constraint: `expert_ID + solution_ID + role_ID` → HTTP 409 |

---

## OData Metadata

```http
GET /api/catalog/$metadata
```

Returns EDMX metadata document describing all entities, functions, and actions.
