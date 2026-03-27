# API Reference

OData V4 services exposed by the **Find My Expert** CAP backend.

---

## Base URLs

| Environment | URL |
|---|---|
| DEV (local) | `http://localhost:4004` |
| BTP CF | `https://<app>.cfapps.<region>.hana.ondemand.com` |

---

## Authentication

| Environment | Method |
|---|---|
| DEV | `Authorization: Basic anonymous:` (auto-injected by app) |
| PROD | XSUAA JWT Bearer token (managed by AppRouter / SSO) |

---

## CatalogService — `/api/catalog/`

Public read-only service. No Admin role required.

### Entities

#### `GET /api/catalog/Topics`

Returns all topic areas.

```http
GET /api/catalog/Topics?$orderby=name
```

```json
{
  "value": [
    { "ID": "t-ai", "name": "AI", "description": "..." },
    { "ID": "t-btp", "name": "BTP", "description": "..." }
  ]
}
```

#### `GET /api/catalog/Solutions`

Returns all solutions, optionally filtered by topic.

```http
GET /api/catalog/Solutions?$filter=topic_ID eq 't-ai'&$orderby=name
```

#### `GET /api/catalog/Experts`

Returns all experts with optional expand.

```http
GET /api/catalog/Experts?$expand=roles($expand=solution($expand=topic))&$orderby=lastName,firstName
```

#### `GET /api/catalog/Experts('{ID}')`

Returns a single expert with all roles expanded.

```http
GET /api/catalog/Experts('e-001')?$expand=roles($expand=solution($expand=topic))
```

```json
{
  "ID": "e-001",
  "firstName": "Thomas",
  "lastName": "Hartmann",
  "email": "thomas.hartmann@sap.com",
  "location": "AT",
  "roles": [
    {
      "ID": "er-001",
      "role": "TOPIC_OWNER",
      "canPresent5M": true,
      "canPresent30M": true,
      "canPresent2H": false,
      "canPresentDemo": true,
      "notes": "",
      "solution": {
        "ID": "s-clouderp-finance",
        "name": "S/4HANA Finance",
        "topic": { "ID": "t-erp", "name": "CloudERP" }
      }
    }
  ]
}
```

---

### Functions

#### `GET /api/catalog/userInfo()`

Returns current user's auth state.

```http
GET /api/catalog/userInfo()
Authorization: Basic anonymous:   # DEV
# or
Authorization: Bearer <xsuaa-jwt> # PROD
```

**Response:**

| Field | Type | Description |
|---|---|---|
| `isAdmin` | Boolean | `true` if user has Admin role |
| `userName` | String | User ID (email in PROD, "Dev/Admin" in DEV) |

```json
{
  "isAdmin": true,
  "userName": "thomas.hartmann@sap.com"
}
```

---

### Actions

#### `POST /api/catalog/searchExperts`

Searches experts using relevance scoring across all fields.

```http
POST /api/catalog/searchExperts
Content-Type: application/json

{ "query": "S/4HANA Finance Austria" }
```

**Query Parameter:**

| Field | Type | Required | Description |
|---|---|---|---|
| `query` | String | ✅ | Search terms (space-separated, case-insensitive) |

**Response — array of expert results:**

| Field | Type | Description |
|---|---|---|
| `expertId` | String | Expert ID (e.g. `e-001`) |
| `firstName` | String | First name |
| `lastName` | String | Last name |
| `email` | String | SAP email |
| `location` | String | Location code (`AT`, `DE`, `CH`) |
| `topicName` | String | Topic name |
| `solutionName` | String | Solution name |
| `role` | String | Role enum value |
| `roleLabel` | String | Human-readable role label |
| `canPresent5M` | Boolean | Presentation capability |
| `canPresent30M` | Boolean | Presentation capability |
| `canPresent2H` | Boolean | Presentation capability |
| `canPresentDemo` | Boolean | Demo capability |
| `score` | Integer | Relevance score 0–100 |
| `isMockMode` | Boolean | Always `false` (future: AI fallback indicator) |

```json
{
  "value": [
    {
      "expertId": "e-001",
      "firstName": "Thomas",
      "lastName": "Hartmann",
      "email": "thomas.hartmann@sap.com",
      "location": "AT",
      "topicName": "CloudERP",
      "solutionName": "S/4HANA Finance",
      "role": "TOPIC_OWNER",
      "roleLabel": "Topic Owner",
      "canPresent5M": true,
      "canPresent30M": true,
      "canPresent2H": false,
      "canPresentDemo": true,
      "score": 100,
      "isMockMode": false
    }
  ]
}
```

**Scoring algorithm:**

| Match | Points per token |
|---|---|
| Exact name match | +50 |
| Partial name match | +30 |
| Exact solution name | +45 |
| Partial solution name | +25 |
| Exact topic name | +40 |
| Partial topic name | +20 |
| Role label | +20 |
| Solution description | +10 |
| Topic description | +8 |
| Notes | +5 |
| Role weight bonus | +0 to +5 |

Results are deduplicated by `expertId + role` and normalized to 0–100.  
Maximum 50 results returned per query.

---

## AdminService — `/api/admin/`

**Requires `Admin` role.** Full CRUD for all master data entities.

> In DEV: automatically accessible (anonymous = Admin).  
> In PROD: requires role collection `FindMyExpert_Admin` assigned in BTP.

### Entities (full CRUD)

- `GET/POST /api/admin/Topics`
- `GET/PATCH/DELETE /api/admin/Topics('{ID}')`
- `GET/POST /api/admin/Solutions`
- `GET/PATCH/DELETE /api/admin/Solutions('{ID}')`
- `GET/POST /api/admin/Experts`
- `GET/PATCH/DELETE /api/admin/Experts('{ID}')`
- `GET/POST /api/admin/ExpertRoles`
- `GET/PATCH/DELETE /api/admin/ExpertRoles('{ID}')`

All entities use standard OData V4 query options: `$filter`, `$expand`, `$orderby`, `$top`, `$skip`, `$select`.

### Validation (server-side, `admin-service.js`)

| Rule | Entity | Detail |
|---|---|---|
| Email format | `Experts` | Regex: `[^\s@]+@[^\s@]+\.[^\s@]+` |
| No duplicate roles | `ExpertRoles` | Unique constraint: `expert_ID + solution_ID + role` → HTTP 409 |

---

## OData Metadata

```http
GET /api/catalog/$metadata
GET /api/admin/$metadata
```

Returns EDMX metadata document describing all entities, functions, and actions.
